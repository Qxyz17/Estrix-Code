# 06 测试与验证

## 命令

```bash
npm run typecheck   # 两套：主应用 strict + hooks
npm test            # Vitest（210+ 用例）
npm run lint        # ESLint
npm run compile     # 构建（含生成物）
```

## 测试目录

```
test/
├── main/      主进程逻辑（session-store、window、providers、dangerous-commands）
├── bridge/    桥接层（js-detector、json-detector、bootstrap-consistency）
├── overlay/   覆盖层（panel、template、extra）
└── tools/     工具（18 个工具 + ToolRegistry + JsRunner）
```

## 测试风格（重要）

**只写"真实集成测试"，不写"深 mock 测试"。**

- 推荐：跑真代码。例：`JsRunner.test.js` 用真 registry + 真 vm 沙箱跑工具调用。
- 避免：mock 内部模块、断言"mock 被调用了"。历史教训（P3a）：280 个深 mock 测试全绿，却漏掉 preload 崩溃。

**原因**：深 mock 测的是"mock 按预期被调用"，不是"功能真能用"。维护成本高（每次改结构要改 mock），收益低。

## bootstrap 一致性测试（D12 的守护）

`test/tools/bootstrap-consistency.test.js` 是重构后新增的关键测试：

- 在隔离 vm 里跑真 `TOOL_BOOTSTRAP`
- 断言：注入的函数名 ↔ 注册表工具名 **完全对应**
- 防止"加了工具但 bootstrap/注册漏了一处"

## 何时必须真机

以下改动 **typecheck 和单测都抓不到**，必须 `npm start` 真机验证：

| 改动 | 为什么 |
|---|---|
| hook（网络拦截） | 运行时注入主世界，序列化行为单测覆盖不了 |
| 工具沙箱注入 | 同上 |
| IPC / 窗口 / view | 需要 Electron 运行时 |
| 覆盖层 UI | 需要真实 DOM + 页面 |

## 失败路径测试（待补）

现状：成功路径覆盖较好，**失败路径不足**（历史上 D20 bug 就是失败路径没测到）。

新需求如果涉及错误处理，**请补失败路径测试**。

## 覆盖率

`npm run test:coverage`（可选）。**不追求数字**，追求"关键路径有测"。
