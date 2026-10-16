# P4 输入：preload 依赖网（P3a 核查时发现）

> 来源：P3a 核查"假 ESM"时发现的真实结构问题。
> 处理时机：P4（按新边界重构），不在 P3a 顺手改（遵守 D1 迁移与重构分离）。

## 问题：src/preload 存在循环依赖网

```
chat-input ←──── watchdog        （chat-input.js:100 用懒 require 打破循环）
    ↑                ↑
intercept-observer ──┘
    ↑
retry-engine ←── compaction
    ↑
  events
```

## 证据

1. `src/preload/dom/chat-input.js:100`：`require('./tool-loop-watchdog')` 写在函数体内
   （懒加载），就是为了打破 `chat-input → watchdog → chat-input` 循环。
2. `tool-loop-watchdog.js` 顶部 import `./chat-input.js`（sendToChat）。
3. `intercept-observer.js` 依赖 `tool-executor`/`chat-input`/`watchdog`，反向也被引用。
4. `compaction.js` 依赖 `chat-input`/`intercept-observer`/`retry-engine`/`watchdog`。

## 影响

- 循环依赖在 ESM 下靠"活绑定 + 运行时取值"勉强工作，但脆弱。
- 阻碍 P3b（TS 类型推断：循环引用处类型可能不完整）。

## P4 建议方向（待定，P4 时决策）

- 引入**事件总线**解耦：watchdog/compaction 等不直接 import chat-input，改为订阅事件。
- 或提取**公共底层模块**（如 `send-to-chat` 单一职责），消除双向依赖。

## 记录时间

2026-09-19（P3a 核查时）
