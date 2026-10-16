---
id: 003
type: feature
title: 工具调用执行遮罩
status: done
branch: feat/003-tool-execution-mask
created: 2026-09-21
updated: 2026-09-21
---

# 003 工具调用执行遮罩

## 背景

AI 输出 `estrix` 代码块后，Estrix Code 会在沙箱执行工具并把结果回传 AI。
这段"检测到工具调用 → 结果发送完成"的窗口期内，用户若在 AI 页面做额外操作
（点发送、改输入框、切会话），会干扰消息回传与工具循环，导致流程错乱。

## 目标

在该窗口期内对 AI 页面加一层全局遮罩：

- 遮罩覆盖整个页面，阻止用户任何点击/输入
- 居中显示 loading 图标 + 文案「工具调用执行中，请不要有额外操作」
- 结果成功发送后自动移除遮罩
- 任何异常/失败路径都必须移除遮罩，不能把用户锁死

## 实现

| 文件 | 改动 |
|---|---|
| `src/overlay/template/overlay.html` | 新增 `#estrix-tool-mask` 遮罩节点（spinner + 文案） |
| `src/overlay/template/overlay.css` | 新增 `.estrix-tool-mask*` 样式（`position: fixed; inset: 0`、z-index 2147483648） |
| `src/overlay/panel.ts` | 新增并导出 `showToolMask()` / `hideToolMask()` |
| `src/overlay/chat-input.ts` | `sendMessageToChat` 支持 `afterSent`；`sendCombinedJsResultsToChat` 改为 async 并返回是否已提交发送 |
| `src/bridge/intercept/observer.ts` | JS 工具分支：显示遮罩 → 执行 → 结果发送完成（或失败兜底）→ 隐藏遮罩 |

## 设计要点

- **隐藏时机**：`sendToChat` 内部有 2~4s 随机延迟后才真正触发发送，因此用 `afterSent` 回调
  而不是 `await sendCombinedJsResultsToChat` 的返回时刻作为"结果已发出"的信号。
- **失败兜底**：找不到输入框等导致发送未提交时立即隐藏遮罩（`sent === false`）；
  执行抛错时在 catch 中隐藏后继续向上抛。
- **范围**：遮罩注入在 AI 页面（`ctx.view`），地址栏壳页面不受影响。
- **不覆盖**：JSON / XML 格式提示属于"提示"而非工具执行，不加遮罩。

## 验证

- `test/overlay/template.test.js`：断言模板含遮罩节点与文案、CSS 含遮罩样式
- `test/bridge/intercept/observer.test.js`：断言执行期间遮罩可见、结束/普通回复时遮罩隐藏
- `npm run typecheck` / `npm test` / `npm run lint` / `npm run compile` 全绿
