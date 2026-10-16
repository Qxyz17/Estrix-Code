# ChatGPT 工具调用问题 — 排查进展（挂起）

> 状态：**挂起**（2026-10-11）
> 关联：PR #47（ChatGPT 登录态适配）、release v0.8.11
> 素材：`tmp/gpt-web2/`（网页 bundle + SSE 原始帧捕获）

## 一、问题描述

ChatGPT 平台的工具循环不好用，具体表现（用户原话）：

1. **工具只调一次就不调了** —— AI 回复一次工具调用后，后续不再继续。
2. 有时"工具不好用"，需要用户手动催"请继续"。

> 用户的临时规避：在提示词里要求 GPT"只调用工具，不要说别的话"，可绕过问题。

## 二、已确认的事实

### 2.1 框架机制（不是 bug）

`src/bridge/intercept/observer.ts:149-156`：

```js
// 4. 普通文本回复：任务完成，退出工具循环
console.log('[Estrix Code][拦截] 正常文本回复，未检测到工具调用');
emitTaskIdle();
```

**判定规则**：AI 那一条回复里**含 \`\`\`estrix 块** → 识别执行 → 回传结果 → AI 继续；
**不含任何代码块（纯解释文字）** → 判定"任务结束"，循环停止。

### 2.2 实测证据（2026-10-11，用 CDP 直连 ChatGPT 页面）

- **工具识别本身正常**：ChatGPT 输出的 \`\`\`estrix id="xxx"\`（带属性）和普通 \`\`\`estrix 都能被 `extractJsToolBlocks` 正确提取（已验证）。
- **多轮工具循环也能跑**：注入"分两步执行"指令时，日志显示连续两轮工具调用都成功（`长度=260 → 执行 → 回传`、`长度=170 → 执行 → 回传`）。
- **停止的原因**：日志里出现 `[拦截] 收到完整回复，长度=564 → 正常文本回复，未检测到工具调用`。dump 页面文本确认，那条 564 字符的回复**确实是纯说明文字**（"把结果发给我后，我会继续读取……"），**不含 estrix 块**。

### 2.3 结论（待最终确认）

**不是"只调一次"，而是 ChatGPT 的行为**：调一小批工具 → 输出一段解释/总结 → 停下等用户。
框架把"纯文本"当作"任务结束"信号，于是循环提前结束。

- **DeepSeek**：倾向连续调工具直到完成 → 循环顺畅。
- **ChatGPT**：倾向"调一批 → 汇报 → 停" → 被框架判定为结束。

## 三、待验证的关键点（下次继续）

**核心疑问**：ChatGPT 那条"纯文本回复"里，究竟是
- **(A)** 真的没有 estrix 块（模型行为），还是
- **(B)** 本来有 estrix 块，但被 hook **提前判定 finished、截断了文本**（技术 bug）？

### 3.1 已捕获的原始 SSE 帧结构（重要素材）

文件：`tmp/gpt-web2/sse-raw-capture.json`（ChatGPT `/backend-api/conversation` 的原始 SSE 流）

实测帧序列（一次完整问答）：

| 帧 | 结构 | 说明 |
|---|---|---|
| 1 | `"v1"` | delta_encoding 标记 |
| 2 | `{type:"resume_conversation_token", ...}` | 恢复令牌 |
| 3 | `{type:"input_message", input_message:{author:{role:"user"}, status:"finished_successfully"}}` | **用户消息**（注意：带 finished_successfully）|
| 4 | `{p:"", o:"add", v:{message:{author:{role:"system"}, status:"finished_successfully"}}}` | system 内部帧 |
| 5 | `{type:"message_marker", ...}` | 标记 |
| 6 | `{v:{message:{author:{role:"assistant"}, ...}}}` | **assistant 消息快照** |
| 7-8 | `{type:"message_marker"}` ×2 | 标记 |
| 9 | `{v:{message:{author:{role:"assistant"}}}}` | assistant 快照 |
| 10 | `{o:"patch", v:[...]}` | **批量操作（patch）** |
| 11 | `{v:[...]}` | **裸 v 数组（无 o）** |
| 12 | `{type:"message_marker"}` | 标记 |
| 13 | `{p:"/message/metadata/...", o:"replace", v:boolean}` | 元数据 patch |
| 14 | `{type:"server_ste_metadata", ...}` | 服务器元数据 |
| 15 | `{type:"message_stream_complete"}` | **流完成** |
| 16 | `[DONE]` | 结束 |

### 3.2 需要在下次确认的解析点

对照 `src/providers/hooks/chatgpt.ts`：

1. **`handleMessage` 用 `text = snap.text`（覆盖而非追加）**（第 266 行）——若 assistant 快照多次下发（帧 6、9），后者会**覆盖**前者的文本。需确认是否丢内容。
2. **`applyStatus` 对 `/message/status` 的 path 判定无正文过滤**（第 304 行）——需确认是否会提前 finished。
3. **帧 3（input_message）带 `status:"finished_successfully"`** —— hook 的 `applyOp` 是否会把用户消息也当完成信号？当前 `handleMessage` 有 `role!=='assistant' return` 防护，但**顶层 `input_message` 走的是别的分支**，需核对。
4. **`o:"patch"` + `v:array(5)`** 与 **裸 `v:array(3)`** —— 需展开数组内容，确认 hook 的批量处理（第 284 行 `Array.isArray(node.v)`）是否完整消费。

## 四、修复方向（候选，未定）

| 方向 | 说明 | 风险 |
|---|---|---|
| **A. 改提示词** | 在 `src/prompt/chatgpt.md` 要求"任务未完成前不要输出解释文字，直接输出下一个 estrix 块" | 低（用户已用类似办法规避）|
| **B. 修 hook 截断** | 若确认是 (B) 提前 finished，修 `chatgpt.ts` 的 status 判定（对齐 `handleMessage` 的防护）| 中，需真机验证 |
| **C. 框架"结束确认"** | AI 输出纯文本时不立即判结束，追问一次 | 高，影响所有平台 |

## 五、涉及文件

- `src/providers/hooks/chatgpt.ts` —— ChatGPT 网络拦截 hook（612 行）
- `src/providers/chatgpt.ts` —— Provider 定义（findInput/fillInput/triggerSend/extractSessionId）
- `src/bridge/intercept/observer.ts` —— 拦截事件处理 + "纯文本=结束"判定
- `src/bridge/parser/js-detector.ts` —— estrix 块提取
- `.estrix/rules/hooks.md` —— hook 规则（自包含 IIFE、改后 compile、只能真机验证）

## 六、恢复工作的步骤

1. 读本文档 + `tmp/gpt-web2/README.md`
2. 展开 `tmp/gpt-web2/sse-raw-capture.json` 的帧 10/11 数组内容，与 hook 解析逐帧比对
3. 在 ChatGPT 页面（CDP 直连；注意应用 CDP 端口可能是 9333 或 9334，看 `start.js`）复现一次"纯文本停"，用 `browser_evaluate` 检查 hook 的 `statusFrames`/`textTail` 诊断输出
4. 定性 (A) 还是 (B) → 按第四节选方案

## 七、环境备注

- 应用 CDP 端口：`start.js` 默认 **9334**（曾为 9333，本次排查时应用重启后为 9334）
- `playwright-estrix` MCP 配的 `--cdp-endpoint http://localhost:9334`（`.estrix/mcp.json`，已被 gitignore）
- ChatGPT 页面 tab 在 playwright 的 `browser_tabs` 中（本次为 index 3）
- 实测注入/抓帧脚本见本文档第三节的 `browser_evaluate` 调用方式
