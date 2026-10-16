# Estrix Code 目标架构

> 状态：草稿 v0.1（待 review）
> 目的：定义模块边界与依赖规则，作为后续 TS 迁移与重构的基准。
> 原则：按「领域」划分，不按「技术层」划分。

---

## 1. 设计原则

1. **单一职责**：一个模块只做一件事，能用一句话说清「它负责什么」。
2. **单向依赖**：下层不依赖上层，无循环依赖。
3. **领域优先**：目录按业务领域组织（session / bridge / tools / providers），不按 electron 的 main/preload 技术层组织。
4. **契约稳定**：对外接口（给 AI 的 API、IPC 通道）显式定义，改动有记录。
5. **可测试**：每个模块能脱离 Electron 运行时被单测（现在部分做不到）。

---

## 2. 目标目录结构

```
src/
├── app/                  应用外壳（启动、窗口、profile、生命周期）
│   ├── entry.ts          原 main/index.js 的启动部分
│   ├── window.ts         原 main/window.js
│   ├── profile.ts        原 main/profile-manager.js
│   └── ipc/              IPC 按领域拆分（见 04）
│       ├── index.ts
│       ├── project.ts
│       ├── session.ts
│       ├── command.ts
│       └── tool.ts
│
├── session/              会话与项目上下文
│   ├── store.ts          原 main/session-store.js
│   ├── project-context.ts 原 main/project-context.js
│   └── compaction.ts     原 preload/dom/compaction.js
│
├── bridge/               【核心】与 AI 网页的桥接（原 preload/dom 大部分）
│   ├── intercept/        网络拦截模式
│   │   ├── observer.ts   原 dom/intercept-observer.js
│   │   └── injector.ts   provider hook 注入逻辑
│   ├── dom-observe/      DOM 抓取模式
│   ├── parser/           回复解析（纯函数，易测）
│   │   ├── js-detector.ts    原 dom/js-detector.js（识别 JS 调用）
│   │   └── json-detector.ts  识别旧的 JSON 调用格式（D11：已废除，仅提示）
│   └── loop/             工具调用循环
│       ├── executor.ts   原 dom/tool-executor.js
│       ├── watchdog.ts   原 dom/tool-loop-watchdog.js
│       └── retry.ts      原 dom/retry-engine.js
│
├── overlay/              【纯 UI】页面覆盖层与交互
│   ├── template.ts       原 overlay/template.js（HTML/CSS）
│   ├── panel.ts          原 overlay/ui.js
│   ├── events.ts         原 overlay/events.js（813 行，需拆）
│   ├── project-dir.ts    原 overlay/project-dir.js
│   ├── chat-input.ts     原 dom/chat-input.js
│   └── session-list.ts   原 dom/session-list.js
│
├── tools/                工具系统（原根目录 tools/ 移入）
│   ├── core/             基类与注册表
│   │   ├── Tool.ts
│   │   ├── ToolRegistry.ts
│   │   └── ToolResult.ts
│   ├── runtime/          沙箱执行
│   │   ├── JsRunner.ts
│   │   └── host-bridge.ts
│   ├── impl/             每个工具一个文件
│   │   ├── read.ts
│   │   ├── read-lines.ts
│   │   ├── write.ts
│   │   ├── edit.ts
│   │   ├── glob.ts
│   │   ├── grep.ts
│   │   ├── bash.ts
│   │   ├── pwsh.ts
│   │   ├── delete-file.ts
│   │   ├── todo-write.ts
│   │   ├── web-fetch.ts
│   │   ├── mysql.ts
│   │   ├── open-browser-window.ts
│   │   ├── inject-js.ts
│   │   ├── attach-file.ts
│   │   ├── mcp-call.ts
│   │   ├── mcp-query.ts
│   │   └── browser-window-manager.ts
│   └── index.ts          单一注册入口
│
├── providers/            平台适配
│   ├── types.ts          Provider 接口（原 custom/provider.d.ts 提升）
│   ├── validate.ts       运行时字段校验（"必须实现接口"的真正强制）
│   ├── registry.ts       原 providers/index.js
│   ├── shared/           内置 provider 共享的公共逻辑（SSE 解码等）
│   │   └── sse.ts
│   ├── deepseek.ts       内置，单文件（元数据 + 提示词 + hook 源码）
│   ├── claude.ts
│   ├── chatgpt.ts
│   └── custom/           用户自定义 provider 加载
│
│   ⚠️ 核心约定（见 03-decisions D5/D13/D14/D15）：
│   - **每个 provider 单文件自包含**：元数据 + hook 源码内联。
│     提示词可选（可内联 `getPromptTemplate()`，也可外置 `src/prompt/{id}.md`）。
│   - **内置与自定义结构完全一致** —— 内置的只是"随程序发布、不需导入"。
│     内置 provider 可 require shared/；自定义必须完全自包含。
│   - **统一实现 Provider 接口**：types.ts 定义 + validate.ts 运行时校验
│     （TS 类型运行时被擦除，强制靠校验函数）。
│   - **用户上传 .js**（非 .ts）：系统不引入运行时编译器，保住"零构建"。
│     写 TS 的人自行编译后上传。运行时两者都是 JS、都过同一校验。
│
├── mcp/                  MCP 集成
│   ├── client.ts         原 main/mcp-client.js
│   └── config.ts         原 main/mcp-config.js
│
├── updater/              自动更新
│   └── index.ts          原 main/updater.js
│
└── infra/                无业务基础设施
    ├── decode-output.ts  原 tools/decodeOutput.js
    ├── dangerous-commands.ts 原 main/dangerous-commands.js
    ├── with-log.ts       原 utils/with-log.js
    ├── paths.ts          新：统一 userData / 日志目录计算
    └── prompt-render.ts  新：提示词模板的变量替换（模板本身由 provider 提供）

# 保留在根目录（Electron 约定）
main.js                  → 薄壳，require('./src/app/entry')
preload.js               → 薄壳，require('./src/bridge/entry')（或保留 src/preload 兼容）
```

---

## 3. 依赖规则（铁律）

### 3.1 单向依赖

```
infra  ←  providers  ←  tools  ←  bridge  ←  session  ←  app
                         ↑           ↑
                      overlay ───────┘（bridge 依赖 overlay）
                         ↑
                         └──────────────────────────────  app
```

- **infra 最底层**：不依赖任何业务模块，不知道 tools/providers 的存在。
- **providers / tools 中层**：可依赖 infra，互不依赖（tools 不 require providers）。
- **overlay**：纯 UI，可依赖 infra；**不依赖 bridge、session**（避免把业务逻辑塞进 UI）。
- **bridge**：可依赖 tools、providers、infra、**overlay**
  （loop 需 overlay 的 UI 能力：toast、回填输入框）。
- **session**：可依赖 bridge、tools、infra（如 compaction 需 bridge 的发消息/等回复能力）。
- **app**：最顶层，可依赖所有。

**关键约束**：`overlay ← bridge` 是**单向**的。overlay 不回头依赖 bridge
（这是防止"UI 里混进业务逻辑"的核心护栏）。

**overlay 如何触发业务**：通过**回调注入**。
- overlay 模块不 `require` bridge/session，而是**接受函数回调**。
- 初始化时（`bridge/entry` 或 `app`）把 `onCompact`、`onSendToolResult` 等回调传入 overlay。
- overlay 只负责"按钮被点了 → 调回调"，不关心回调里做什么。
- 好处：overlay 保持"哑"（纯界面 + 交互），可独立测试；业务链路清晰。

示例：
```ts
// overlay/events.ts —— 不 require 业务
export function bindEvents(handlers: {
  onCompact: () => void;
  onSendToolResult: (result: string) => void;
  // ...
}) {
  document.getElementById('btn-compact')
    .addEventListener('click', () => handlers.onCompact());
}
```

### 3.2 禁止项

- ❌ 下层 require 上层（如 infra 里 require tools）
- ❌ 循环依赖
- ❌ overlay 里做工具执行 / 网络拦截
- ⚠️ tools 里直接用 Electron API（允许，但应经间接层，见 3.3）

### 3.3 特例：工具与 Electron

**决策：允许工具依赖 Electron，不做依赖注入解耦。**

理由：
1. 部分工具（`OpenBrowserWindowTool`、`InjectJSTool`）的 Electron 依赖是**本质的**——
   不调 Electron 就没有存在意义。注入假 Electron 来单测，测的是假对象，价值有限。
2. 已有间接层：`browser-window-manager` 已在工具与 `BrowserWindow` 之间隔了一层，
   工具依赖 manager 而非直接摸 Electron API，已够用。
3. 避免为"假设性的可测性"改动工具构造签名、复杂化 `tools/index` 注册。

**要求（现状已符合）**：把工具中的**纯逻辑**（路径解析、格式判断、代码构造）
导出为独立函数以便单测。例如 `AttachFileTool` 已导出
`resolveFilePath` / `guessMimeType` / `buildInjectCode`。

**即**：解耦"可测的逻辑"，而非"Electron 本身"。

### 3.4 强制手段

用 ESLint `import/no-restricted-paths` 规则固化上述方向。配置示例：

```jsonc
"import/no-restricted-paths": ["error", {
  "zones": [
    { "target": "./src/infra", "from": "./src/tools" },
    { "target": "./src/infra", "from": "./src/providers" },
    { "target": "./src/tools", "from": "./src/bridge" },
    { "target": "./src/overlay", "from": "./src/bridge" }
  ]
}]
```

---

## 4. 与现状的映射

| 现状路径 | 目标路径 | 变化 |
|---|---|---|
| `main.js`（薄壳） | 保留 | 改指向 app/entry |
| `preload.js`（薄壳） | 保留 | 改指向 bridge/entry |
| `src/main/index.js` | `src/app/entry.ts` | 拆：启动逻辑留，userData 逻辑入 paths |
| `src/main/window.js` | `src/app/window.ts` | 平移 |
| `src/main/profile-manager.js` | `src/app/profile.ts` | 平移 |
| `src/main/ipc.js` | `src/app/ipc/*` | **拆分**（9 个通道按领域分 5 个文件） |
| `src/main/session-store.js` | `src/session/store.ts` | 平移 |
| `src/main/project-context.js` | `src/session/project-context.ts` | 拆：变量替换入 prompt-render |
| `src/main/mcp-client.js` | `src/mcp/client.ts` | 平移 |
| `src/main/mcp-config.js` | `src/mcp/config.ts` | 平移 |
| `src/main/updater.js` | `src/updater/index.ts` | 平移 |
| `src/main/dangerous-commands.js` | `src/infra/dangerous-commands.ts` | 平移 |
| `src/main/tool-registry.js`（14 行） | 删除 | 逻辑并入 tools/index |
| `src/preload/index.js` | `src/bridge/entry.ts` | 重命名 + 归位 |
| `src/preload/api.js` | `src/bridge/api.ts` | 平移 |
| `src/preload/tool-names.js` | **删除** | 从 tools 注册表动态生成 |
| `src/preload/dom/state.js` | **拆解** | 状态按领域归属到各模块 |
| `src/preload/dom/intercept-observer.js` | `src/bridge/intercept/observer.ts` | 平移 |
| `src/preload/dom/js-detector.js` | `src/bridge/parser/js-detector.ts` | 平移 |
| `src/preload/dom/tool-parser.js` | `src/bridge/parser/json-detector.ts` | 改：只识别不解析（D11） |
| `src/preload/dom/tool-executor.js` | `src/bridge/loop/executor.ts` | 平移 |
| `src/preload/dom/tool-loop-watchdog.js` | `src/bridge/loop/watchdog.ts` | 平移 |
| `src/preload/dom/retry-engine.js` | `src/bridge/loop/retry.ts` | 平移 |
| `src/preload/dom/compaction.js` | `src/session/compaction.ts` | 归入 session |
| `src/preload/dom/chat-input.js` | `src/overlay/chat-input.ts` | 归入 overlay |
| `src/preload/dom/session-list.js` | `src/overlay/session-list.ts` | 归入 overlay |
| `src/preload/overlay/ui.js` | `src/overlay/panel.ts` | 平移 |
| `src/preload/overlay/events.js` | `src/overlay/events.ts` | **拆分**（813 行） |
| `src/preload/overlay/template.js` | `src/overlay/template.ts` | 平移 |
| `src/preload/overlay/project-dir.js` | `src/overlay/project-dir.ts` | 平移 |
| `tools/*` | `src/tools/*` | **移入 src** |
| `src/providers/*` | `src/providers/*` | 内部分目录 |
| `src/utils/with-log.js` | `src/infra/with-log.ts` | 平移 |
| `src/prompt/*.md` | 保留 | D5：provider 提示词来源 + 自定义兜底 |
| `tools/estrix-tools.d.ts` | `src/tools/api.d.ts` | 归位 |

### 4.1 删除动作的保守流程（适用于表中所有"删除/拆解"）

**原则：不直接删，先隔离观察，确认无引用再删。**

步骤：
1. **标为废弃**：在文件头加 `@deprecated` 注释，**保留在原位**，功能不变。
2. **收窄引用**：把所有 `require` 改为经统一入口（如 `tools/index`），确保无间接/动态引用。
3. **观察期**：跑完整测试 + 手动冒烟关键路径 + 使用一段时间。
4. **真删**：确认无引用后删除文件，跑测试验证。

**为什么**：这些文件可能被**动态引用**（字符串拼路径、运行时 `require(variable)`），
单纯 grep 不一定找得到。保守流程能避免"删了才发现某处崩"。

**适用于**：`tool-registry.js`、`tool-names.js`、`state.js`（拆解）。

---

## 5. 待决策事项

本架构涉及的未决事项（契约可否改、旧别名去留、prompt 合并、IPC 命名、tools 移入）
**统一记录在 `03-decisions.md`**，那里是决策的唯一权威（含背景/备选/结论/日期/状态）。

本文件只描述「目标架构长什么样」，不承载决策详情，避免两处不一致。

---

## 6. 本文档的下一步

架构定稿后，进入 P1（清理死代码）。详见 `04-plan.md`。
