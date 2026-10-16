---
id: 023
type: fix
title: ChatGPT 初始化填入失败 + 工具结果发送失败（含上下文耗尽自动续接）
status: done
branch: fix/023-chatgpt-input-send
created: 2026-10-13
updated: 2026-10-13
---

## 背景

ChatGPT 平台出现两个阻断性问题：

1. **初始化项目后系统提示词填不进去 / 要等很久 / 有时不发送**
   - 日志：`输入框写入校验失败：期望约 19873 字，实际 0 字` 连续 21 次，第 22 次才成功（≈10.5s）；
     重试到上限 30 次仍失败则放弃（表现为「不发送」）。
2. **工具执行完，回传结果卡在输入框发不出去**
   - 日志：`已通过站点原生发送触发` 之后无后续（消息实际没发出去）。

进一步排查发现「发不出去」可能有两种成因，本需求一并覆盖：

- (a) 填入/焦点问题（已定位并修复，见方案一/二/三）
- (b) **会话上下文耗尽**：ChatGPT 提示「聊天上下文已用完」后拒绝继续发送，
  工具结果卡在输入框。需检测该状态并**自动新开会话 + 保留项目目录**，否则项目目录丢失、
  后续工具调用拿不到 projectDir。

## 目标

- ChatGPT 初始化时系统提示词能**快速、可靠**填入并发出
- 工具执行结果回传后能**自动发出**（不再卡在输入框）
- **上下文耗尽时自动新开会话，并自动用原项目目录初始化**（projectDir 不丢）；
  覆盖两种时机：① 工具结果发不出时 ② AI 回复完但无工具调用、恰好撞上耗尽时

## 方案

### 一、findInput 改用 querySelectorAll 遍历找可见元素（问题 1 根因）

**根因**：ChatGPT 页面同时存在**多个** `.ProseMirror`（首页含隐藏的模板编辑器）。
`document.querySelector` 只返回**第一个匹配** → 命中**隐藏**元素 → `execCommand('insertText')`
往隐藏元素写 → 静默失败（实测 `insertRet: false`，内容为空）。

**修复**（`src/providers/chatgpt.ts`）：`findInput` 用 `querySelectorAll` 遍历，返回第一个**可见**的元素。

**验证**：CDP 实测——往可见的 ProseMirror 写 `insertText` 返回 `true` 且内容写入成功。

### 二、triggerSend 优先真实鼠标点击发送按钮（问题 2 根因）

**根因**：AI 页面无焦点（`document.hasFocus() === false`，用户焦点在壳窗口/别的窗口）时，
主进程 `sendInputEvent` 的**键盘事件送不到页面** → Enter 落空 → 消息发不出去。
且 `chat-send-enter` 无条件 `return true`，把失败吞掉（日志显示「已通过站点原生发送触发」但实际没发）。

**修复**：
- `src/providers/chatgpt.ts` `triggerSend`：优先**真实鼠标点击**发送按钮（鼠标事件不受焦点影响）
  + 点击后校验输入框是否被清空（发送成功标志）；失败回退 Enter；再失败 DOM click
- `src/app/ipc/renderer.ts` `chat-send-enter`：发送前先 `sender.focus()` 让 view 获得键盘焦点

**验证**：Playwright 真实鼠标点击发送按钮 → 输入框从 87 字变 1 字（清空=发送成功）。

### 三、fillInput 加读回校验（防御）

`src/providers/chatgpt.ts` `fillInput`：写入后读回校验（去空白长度 ≥ 期望的 90%），
失败返回 false（而非无条件 true），让上层重试。

### 四、上下文耗尽 → 自动新开会话 + 保留项目目录（已实现，真机未验证触发）

**复用现有能力**：`new-conversation-for-project` IPC（`src/app/ipc/session.ts`）**已实现**——
导航到平台首页 + `did-finish-load` 后自动 `initProject(projectDir)`。本功能只需：
**检测信号 → 调用该 IPC**。

**检测**：识别「聊天上下文已用完」提示（DOM 文案，如「聊天上下文已用完」/「Your context is full」），
或检测「发送后输入框不清空且无回复」。

**触发**：在 `overlay`/`bridge` 检测到信号 → 调 `electronAPI.newConversationForProject(projectDir)`；
projectDir 从当前 sessionStore 取。

### 五、工具循环文本提取修复（本轮真机排查，核心）

ChatGPT 一条 SSE 流会下发**多条 assistant 消息** + **重放帧**，原 hook「单 text 变量朴素累加」导致
文本重复/交错 → 破坏 estrix 围栏 → 提取 0 块 → 工具不执行。逐层修复：

- **按消息 id 分段**：segments[{id,text}]，快照覆盖本段，syncText 按序拼接
- **channel/recipient 过滤**：只累积 channel∈{null,final} + recipient∈{null,all} + content_type=text 的正文消息
- **正文 append 全局去重**：服务端重放帧，且重放时同一 patch 内夹着别的 path（metadata 等）操作，
  「紧邻去重」会失效 → 改全局去重（key=seg|path|value）
- **围栏按实际反引号数剥离**：快照+append 叠加会产生 6 个反引号，原 slice(3) 只剥 3 个 → 解析失败
- **truncate 处理**（防御，真机暂未出现）

**源码研究结论**：ChatGPT SSE 是 {p,o,v} JSON-Patch 风格（前端 applyDelta，per-channel）。
真机 op 只有 add/patch/append/replace，无需推倒重写；补齐上述去重即可。
参考 DeepSeek hook（同为 {p,o,v} 朴素累加，流结构更简单）——方向印证，无直接可搬实现。

### 六、发送重试增强

triggerSend：循环最多 10 次（约 6 秒），每次用最新 DOM，交替尝试「真实鼠标点击 / Enter」。
修「填入大文本后按钮延迟就绪 → findSendButton 返回 null → 直接放弃」的问题。

### 七、工具结果末尾追加提醒

sendCombinedJsResultsToChat 在工具结果消息**末尾**追加固定提醒：
「提醒：需要给我结果或需要我确定的回答中不要调用工具哦。」
位置在 applyResultTransform **之后**（保证在末尾、不被 provider transform 影响），
避免 AI 在本该给结论/该问用户时仍继续调工具。

## 验收标准

- [x] ChatGPT 初始化项目：系统提示词快速填入并发出（不再卡 10s+ / 放弃）
- [x] ChatGPT 工具执行：结果自动发出（不再卡在输入框）
- [x] ChatGPT 工具循环稳定（有 estrix 块必执行，不再因文本重复而漏执行）
- [ ] 上下文耗尽时自动开新会话并保留 projectDir（**已实现链路，真机未验证触发**）
- [ ] 新会话能正常调用工具（projectDir 未丢）
- [x] typecheck / compile / test（873 passed）全绿

真机验证方式：重启应用 → ChatGPT 窗口初始化项目 + 触发工具调用，观察行为与日志。

## 遗留 / 后续

- **上下文耗尽自动续接未触发（本需求唯一未验收项）**：链路已实现
  （hook 检测 `conversation_detail_metadata.banner_info.call_to_action` 含 `continue_in_new_chat`
  → `estrix-context-exhausted` 事件 → bridge → IPC `context-exhausted-continue`
  → 导航首页 + `initProject(projectDir)`），但真机未验证成功触发。待单独排查
  （可能是 banner 字段实际值/时机与预期不符，日志有 `banner_info` 打点可查）。
- **临时诊断代码保留**（本轮排查所加，后续改造用）：hook 的 `opLog`/`logOp`/`seenFrames`/
  `observeBody 启动`/原文特征/ `DUP-SKIP` 日志；observer 的原文特征 + 提取失败全文 + `banner_info` 打点。
- **问题：初始化浮动窗口出现「全选/框选」感**——疑与 `execCommand('selectAll')` /
  `selectNodeContents(input)` 有关，待验证。
- **SSE 协议完整性**：真机只用 `add/patch/append/replace`；`remove`/`truncate`/per-channel 隔离未完整实现
  （`truncate` 已加防御），需多场景采样（重新生成/停止/长回复）后再决定。
- `chat-input.ts` 兜底的 `querySelector('div[contenteditable...]')`（L271）有同样的「多匹配」隐患，本次未改。
- 详细排查记录见 `docs/prompts/chatgpt-test-log.md`、`docs/prompts/chatgpt-tool-loop-investigation.md`。
