# 任务提示词：为 Estrix Code 补全单元测试

> 用法：把本文件内容整段复制给新的 AI 对话，让它按此执行。

---

## 第一步：先了解项目（必做）

先完整阅读 `docs/architecture.md` 及其 6 篇分册（`docs/arch/01-structure.md` ~ `06-testing.md`），尤其：

- `01-structure.md`：每个文件的职责（知道被测模块在哪）
- `02-dependency.md`：依赖方向（写测试时不要跨层乱引）
- `06-testing.md`：**测试哲学**（最重要，见下）

再扫一眼现有测试 `test/**/*.test.js`，了解写法风格。

## 第二步：遵守测试哲学（硬要求）

本项目经历过一次重构，有一条用血换来的教训（决策 D21）：

> **只写"真实集成测试"，不写"深 mock 测试"。**

- ✅ 跑真代码：例 `test/tools/JsRunner.test.js` 用真 registry + 真 vm 沙箱跑工具调用。
- ❌ 禁止 mock 内部模块、断言"mock 被调用了"。
- 原因：历史上 280 个深 mock 测试全绿，却漏掉 preload 崩溃——深 mock 测的是"mock 按预期被调用"，不是"功能真能用"，维护成本高、收益低。

**若某模块难以"跑真代码"（如强依赖 Electron 运行时），不要硬 mock，直接跳过并在最终报告里标注"需真机验证"。**

## 第三步：技术约定

- 测试框架：Vitest 5（全局 API 关闭，须显式 `import { test } from 'vitest'`）
- 断言：`node:assert`（`import assert from 'node:assert'`）
- 文件头：`'use strict';`
- 目录：`test/` 镜像 `src/` 结构（如测 `src/bridge/loop/watchdog.ts` → `test/bridge/loop/watchdog.test.js`）
- 命名：`<模块名>.test.js`
- 用 `beforeEach`/`afterEach` 管理临时目录，用 `test/tmp/` 下子目录，测完清理
- **不要测自动生成文件**（`*.generated.ts`、`src/tools/api.d.ts`）——它们由构建脚本产出

## 第四步：待补的模块（按优先级）

现有测试已覆盖：tools 下 18 个工具 + core + JsRunner、bridge 的 parser、overlay 的 panel/template、main 的 session-store/window/providers/dangerous-commands。**以下是缺口，按优先级补：**

### P0 —— 纯逻辑、易测、价值高

1. `src/providers/hooks/shared/sse.ts` —— `createFrameDecoder` / `extractData` / `parseBlock`
   （SSE 帧解码，三平台 hook 共用；纯函数，重点测边界：分块到达、`\r\n`、`[DONE]`、空块、坏 JSON）
2. `src/bridge/intercept/observer.ts` —— 事件分派逻辑
   （`estrix-ai-response` 的 finished/stopped/error 分支；`onInterceptedResponse`/`onAiError` 订阅；注意它依赖 `window.addEventListener`/`CustomEvent`，可在 node 环境模拟全局）
3. `src/bridge/loop/watchdog.ts` —— 工具循环看门狗状态机
   （进入/退出循环、超时催继续、会话切换失效、计数上限、暂停）
4. `src/bridge/loop/retry.ts` —— 失败自动重试引擎
   （退避、计数、429 单独计数、会话校验、压缩期间暂停）

### P1 —— 逻辑较独立

5. `src/session/prompt-builder.ts` —— 占位符替换（`{{TOOLS_LIST}}` 等）、模板选择优先级
6. `src/overlay/panels/settings.ts` —— 配置校验（`openSettings`/`saveSettings`/`resetSettings` 的边界与非法值）
7. `src/providers/validate.ts` —— provider 字段校验（D14）
8. `src/providers/registry.ts` —— `getProvider` / `getProviderByUrl` / 自定义加载

### P2 —— 简单工具类

9. `src/tools/core/ToolResult.ts` / `Tool.ts` —— 简单的类行为
10. `src/infra/markdown.ts`（`BT`/`FENCE`）、`src/infra/with-log.ts`
11. `src/bridge/loop/executor.ts` —— 执行 JS 脚本并渲染（注意依赖 DOM，尽量测纯逻辑部分）

### 跳过（需 Electron 运行时，标"需真机验证"）

`src/app/**`、`src/infra/paths.ts`、`src/mcp/client.ts`、`src/tools/impl/attach-file.ts`、`src/tools/impl/browser-window-manager.ts`、`src/tools/impl/open-browser-window.ts`、`src/updater/**`。

## 第五步：特别强调——补"失败路径"测试

历史 bug（D20）暴露了"只测成功路径"的隐患。补测试时**优先覆盖错误分支**：

- 参数非法 / 缺字段
- 文件不存在 / 权限错误
- 网络失败 / 超时 / 状态码异常
- 空输入 / 边界值

## 第六步：每步验证（硬要求）

每加一个测试文件，立即跑：

```bash
npm run typecheck   # 必须 0 错误
npm test            # 必须全绿（现有 210 个不能挂）
npm run lint        # 必须 0 problems
```

**任何一个不绿，先修好再继续，不要带病前进。**

## 第七步：交付

- 每完成一个模块的测试，单独提交一次（commit message 说清补了哪个模块）
- 全部完成后，产出一份**简短报告**：
  - 新增了哪些测试文件
  - 哪些模块跳过了、为什么（"需真机验证"）
  - 建议后续补的失败路径清单

## 记住

- 先读 `docs/architecture.md`，不理解模块职责不要动手
- 不 mock 内部模块
- 失败路径优先
- 每步验证，全绿才继续
