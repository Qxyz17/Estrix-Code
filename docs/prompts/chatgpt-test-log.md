# ChatGPT 工具循环 / 初始化 测试记录

> 状态：进行中（2026-10-13）
> 目标：边测试边记录问题，攒齐后统一修改

## 待排查问题清单

### 问题 1：初始化项目后发送延迟大 / 有时不发送  【根因已定位】

**现象**：初始化项目后，要等很久才发送提示词；有时甚至不发送。

**日志证据**：
```
07:24:41 收到 initial-prompt 长度=23420
07:24:41 首次查找输入框结果=找到
输入框写入校验失败：期望约 19874 字，实际 0 字   ← 连续 21 次
初始提示填充失败 → 重试（第 1..21 次）
初始提示已填入，随机等待 2671ms 后发送...        ← 第 22 次成功
```

**根因**：ChatGPT 的 fillInput 用 execCommand('insertText') 填入；页面刚导航/重渲染时静默失败
（不报错、内容没写进去）。setInputContent 读回校验发现 0 字 → 返回 false → 外层 500ms×N 硬等，
失败 21 次 ≈ 10.5 秒（表现为『等很久』）；到上限 30 次放弃（表现为『不发送』）。

**修复**（src/providers/chatgpt.ts fillInput）：写入后读回校验 + 内部每 200ms 密集探测（上限 3s）
+ input.isConnected 检测（脱离 DOM 立即交回外层）。

### 问题 2：初始化项目浮动窗口出现「全选/框选」感  【待调查】
- **现象**：初始化项目的浮动窗口（首次初始化对话框）出现类似「全选」的框选效果
- **可能线索**：setInputContent 的 execCommand('selectAll') + chatgpt fillInput 的 selectNodeContents
  —— 二者都会『选中输入框全部内容』；若随后 delete/insertText 未立即执行，用户看到高亮全选
- 状态：待验证

### 问题 3：工具结果执行完没有发送  【根因已定位+修复】

**现象**：ChatGPT 工具执行完，回传结果显示在输入框里，但消息发不出去（卡在输入框）。

**日志证据**：
```
回传 JS 汇总执行结果, 消息长度=76
消息已填入输入框，等待 3783ms 后发送...
已触发发送, JS汇总, 长度=76
已通过站点原生发送触发          ← 之后无『收到完整回复』
```

**根因**：
- 页面检查：document.hasFocus() === false（AI 页面无焦点，用户焦点在壳/别的窗口）
- 主进程 sendInputEvent 的键盘事件依赖页面有焦点，无焦点时 Enter 送不到 → 发不出去
- 且 chat-send-enter 无条件 return true，把失败吞了（日志显示『已通过站点原生发送触发』但实际没发）

**验证**：用 Playwright 真实鼠标点击发送按钮 → 输入框从 87 字变 1 字（清空=发送成功）

**修复**：
- src/providers/chatgpt.ts triggerSend：优先真实鼠标点击发送按钮（sendInputEvent 鼠标事件不受焦点影响）
  + 点击后校验输入框是否清空（成功标志）；失败回退 Enter；再失败 DOM click
- src/app/ipc/renderer.ts chat-send-enter：发送前先 sender.focus() 让 view 获得键盘焦点

## 抓取器状态
- ChatGPT 页面已装 window.__ckCap（记录 /backend-api/conversation 的 SSE 原始流）
- 待触发场景：重新生成 / 停止生成 / 长回复

## 附：SSE 协议已知信息
- ChatGPT 用 delta_encoding: v1 协议（增量 delta，前端 applyDelta 按 per-channel 累积）
- 当前 hook 用朴素累加，实测单个样本可行
