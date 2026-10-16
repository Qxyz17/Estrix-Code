# P4 输入：迁移过程中发现的结构性问题

> 来源：P3a（ESM 转换）+ P3b（TS 迁移）过程中暴露的既有问题。
> 原则：迁移期**只记录、不顺手重构**（D1）。P4 按目标架构统一处理。
> 时间：2026-09-19 ~ 2026-09-20

---

## 1. preload 循环依赖网（P3a 发现）

详见 `P4-input-preload-deps.md`。

**摘要**：`chat-input ↔ tool-loop-watchdog` 等形成循环依赖，原用懒 require 打破，
P3a 改为 ESM 静态 import（活绑定）后可运行，但仍是脆弱结构。

**P4 方向**：引入事件总线解耦，或提取公共底层模块。

---

## 2. tools → src/main 依赖违规（P3b 发现，3 处）

**位置**：
```
tools/McpCallTool.ts:49    const mcpClient = require('../src/mcp/client');
tools/McpQueryTools.ts:37  const mcpClient = require('../src/mcp/client');
tools/McpQueryTools.ts:99  const mcpClient = require('../src/mcp/client');
```

**问题**：违反架构依赖方向（tools 不得依赖 app/main）。
eslint.config.js 目前用 `except: ['mcp-client']` 豁免（标注"P4 解耦后移除"）。

**额外风险**：这 3 处是**惰性 require**（在 execute() 体内）。迁移 mcp-client.js→.ts 后，
**源码态（vitest）会解析失败**（找不到 .ts），仅编译产物 out/ 下正常。
当前测试未触发这些路径，故暂绿——**是潜伏雷**。

**P4.1 已部分处理**：mcp-client 已从 `src/main/` 移至 `src/mcp/`（P4.1，commit 372d4b6），
tools→main 的路径违规已消除。但 **tools→mcp 的跨领域依赖**仍待 P4.3（tools 重组）
或 P4.4 决定分层归属；3 处 require 保留 TODO。

**仍存风险**：源码态 require 无扩展名，vitest 解析失败（仅 out/ 正常）；
当前测试未触发。P4.3 重组 tools 时一并处理（改静态 import 或调整分层）。

---

## 3. flashBadge 形参不匹配（P3b 发现）

**位置**：
```
src/preload/overlay/ui.ts:flashBadge()        ← 定义无参
src/preload/dom/tool-executor.ts:19/30        ← 调用传参（被忽略）
```

**现状**：P3b 已改为 `flashBadge(_title?: string)`（类型诚实，运行时行为不变）。

**P4 方向**：决定"这个 title 该不该真的用"——若该用，实现它（显示在提示里）；
若不该用，调用点删实参。**当前是有意保留的信息，待 P4 决策**。

---

## 4. retry-engine 的 AOP 重赋值（P3b 发现）

**位置**：`src/preload/dom/retry-engine.ts`（10 处）
```
let readConfig = function readConfig() {...};
...
readConfig = withLog(readConfig, 'retry.readConfig');   ← 运行时猴子补丁
```

**问题**：这是**运行时重赋值**（类 AOP）。在 TS 下必须用 `let ... = function` 迁就
（TS2630：function 声明不能重赋值）。说明此模式**天生和类型系统打架**。

**P4 方向**：AOP 日志装饰器该不该改成**显式包装**（`const readConfig = withLog(...)`
一次性定义），而非事后重赋值？让类型系统自然接受。

---

## 5. 失败路径缺测试（P3b 发现，D20 bug 暴露）

**事件**：D20 重构（我做的）漏改了 `project-context` 错误分支的引用
（删了 `toolApiTypePaths` 声明却漏改引用它的 `console.error`）。
**218 测试全绿，没抓到**——因为没有测试覆盖该失败路径。

**含义**：当前测试是"快乐路径"测试，覆盖不了健壮性。

**P4 方向**：补**失败路径测试**（文件缺失、加载失败、会话切换、超时等）。

---

## 6. ESLint 对 .ts 失效（P3b 发现，D22）

**问题**：
- eslint.config.js 只配 `**/*.js`，src/tools 迁 .ts 后**完全不被检查**。
- 自定义依赖护栏规则只匹配 `require()`，不匹配 ESM `import`。

**现状**：推迟到 P5（typescript-eslint 与 TS7 不兼容，D22）。

**P4/P5 方向**：TS7 生态跟上后，用 typescript-eslint 覆盖 .ts，
并扩展护栏规则识别 import。届时护栏才能在 P4 重组中发挥作用。

---

## 7. provider.template.js 保留（有意）

`src/providers/custom/provider.template.js` 是**模板资产**（供用户复制改写的样例），
**不是运行时模块**，故保持 .js。P4 若调整自定义 provider 机制，一并评估。

---

## 8. P4.2-B 遗留：overlay ↔ bridge 违规依赖（待 P4.2-A 解耦）

**背景**：P4.2 分两步。B 步（文件归位）已完成，但为控制风险，**临时保留**了以下
违反"overlay 不依赖 bridge"铁律的依赖，待 A 步（回调注入）解决：

| 位置 | 依赖 | 状态 |
|---|---|---|
| `overlay/chat-input.ts` | `bridge/loop/watchdog`、`bridge/parser/js-detector` | ✅ 已解（db39e6a） |
| `overlay/events.ts` | `bridge/intercept/observer` | ✅ 已解（db39e6a） |
| `bridge/intercept/observer`、`session/compaction` | `overlay/state`（反向依赖） | ✅ 已解（回调推送 meta） |

**A 步方向**（架构文档 3.1）：
- overlay 模块不 import bridge，而是接受回调（如 `onSendToChat`、`onInterceptedResponse`）
- 由 `bridge/entry` 初始化时注入实现
- `chat-input` 需**拆**：输入框操作（纯 UI）留 overlay；"发消息给 AI 页面"能力变回调

**其它遗留**：
- `overlay/state.ts` 的 `serverTokenUsage`（bridge 写、overlay 读）、
  `lastResponseMsgIds`（bridge 写、session 读）→ 改**推送**而非共享读写
- `state.pendingToolCall` **死字段**（0 引用）→ 删
- `bridge/tool-names.ts`：**保持现状**（纯常量、无耦合）。
  不能在 preload 里 import registry（tools/index 是主进程代码，含 Electron 主进程 API）。
  正解是 D12（构建期生成），**推迟到 P5**——届时用编译器生成工具名列表，preload 读静态产物。
- `test/preload/` 目录名过时（源码已不在 preload）→ 可改名 `test/bridge`+`test/overlay`

---

## 汇总：P4 待办清单

- [ ] 解耦 preload 循环依赖（事件总线/公共模块）
- [x] mcp-client 移至 src/mcp（P4.1）；tools→mcp 分层待 P4.3/P4.4
- [ ] flashBadge title 语义决策
- [ ] retry-engine AOP 改为显式包装
- [ ] 补失败路径测试
- [x] mcp-client 移至 src/mcp（P4.1）
- [x] preload 文件归位（P4.2-B）
- [ ] overlay↔bridge 回调注入解耦（P4.2-A）
- [ ] state 跨层字段改推送 + 删死字段
- [ ] bridge/tool-names 从 registry 生成
- [ ] （P5）ESLint 覆盖 .ts + 护栏识别 import
