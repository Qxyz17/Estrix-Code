# Estrix Code 模块职责表

> 状态：草稿 v0.1（待 review）
> 配套：`01-architecture.md`
> 用途：每个模块「做什么 / 不做什么」的清单，作为拆分与验收基准。

---

## 阅读方式

每模块三栏：
- **职责**：它负责什么（越短越好，一件事）
- **对外接口**：它向谁暴露什么（函数 / 类 / 常量）
- **不做**：明确排除的事（防止职责膨胀）

---

## infra/ —— 无业务基础设施

### infra/paths.ts
- **职责**：计算并缓存所有运行时路径（userData、日志目录、MCP cwd）
- **对外接口**：`getUserDataDir()` / `getLogDir()` / `getMcpCwd()`
- **不做**：不创建目录（调用方负责）、不读配置

### infra/decode-output.ts
- **职责**：命令输出字节流 → 文本（UTF-8 / GBK 回退）
- **对外接口**：`decodeOutput(buf)` / `normalizeCommand(cmd)`
- **不做**：不执行命令

### infra/dangerous-commands.ts
- **职责**：判断命令是否危险
- **对外接口**：`isDangerous(cmd)`
- **不做**：不抛异常、不弹窗（由调用方决定）

### infra/with-log.ts
- **职责**：AOP 式函数调用日志包装
- **对外接口**：`withLog(fn, label)`
- **不做**：不写文件（只 console）、不改函数行为

### infra/prompt-render.ts
- **职责**：把提示词模板里的 `{{XXX}}` 占位符替换为运行时值
- **对外接口**：`renderTemplate(tpl, vars)`
- **不做**：不决定用哪份模板（模板由 provider 提供）、不发消息
- **说明**：D5 后提示词归属 provider，此模块只做"变量替换"这一件事

---

## providers/ —— 平台适配

### providers/types.ts
- **职责**：定义 `Provider` 接口（类型契约）
- **对外接口**：`Provider` 类型、`ProviderInputs` 等
- **不做**：不含运行时代码

### providers/validate.ts
- **职责**：**运行时**校验 provider 是否实现了必需字段
  （`id`/`name`/`homeUrl` 等），缺失则报明确错误
- **对外接口**：`validateProvider(obj)`
- **不做**：不做类型检查（TS 类型运行时已擦除，故靠字段校验强制）
- **说明（D14）**：这是"必须实现接口"的**真正强制手段** —— TS 给开发时提示，
  校验函数给运行时保障，两者都要有

### providers/registry.ts
- **职责**：加载内置 + 自定义 provider，提供按 id / url 查找
- **对外接口**：`getAllProviders()` / `getProvider(id)` / `getProviderByUrl(url)`
- **不做**：不创建窗口、不注入 hook

### providers/{deepseek,claude,chatgpt}.ts
- **职责**：单个内置平台的**完整定义，单文件自包含** ——
  元数据（id/name/homeUrl/选择器/URL 匹配）+ 内联的主世界 hook 源码
- **对外接口**：导出 `Provider` 对象（含 `getHookSource()`）
- **不做**：不做网络拦截的实际注入（注入由 bridge 负责）
- **约束（D5/D13）**：**提示词可选** —— 可内联（`getPromptTemplate()`），
  也可外置为 `src/prompt/{id}.md`（**内置用文件形式**）。
  内置与自定义**结构一致**，内置的只是"随程序发布、不需导入"。
  内置可 `require('../shared/*')`

### providers/shared/*.ts
- **职责**：内置 provider 共享的公共逻辑（如 SSE 帧解码）
- **对外接口**：按需导出（如 `createFrameDecoder()`）
- **不做**：不含具体平台差异
- **约束**：**仅内置 provider 可引用**；自定义 provider 不得依赖它

### providers/custom/loader.ts
- **职责**：用户自定义 provider 的导入/删除/持久化
- **对外接口**：`loadCustomProviders()` / `importProvider(file)` / `deleteProvider(id)`
- **不做**：不执行 provider 代码（只加载）
- **约束（D13/D15）**：自定义 provider **必须单文件自包含**
  （元数据 + hook 内联；提示词可内联或依赖 `default.md` 兜底，不得 require 其他模块）。
  **用户上传 `.js`**（非 `.ts`）—— 系统不引入运行时编译器，保住"零构建"；
  写 TS 的人自行编译后上传。加载后过 `validate.ts` 校验。

---

## tools/ —— 工具系统

### tools/core/Tool.ts
- **职责**：工具基类（name / description / parameters / jsApi）
- **对外接口**：`Tool` 抽象类
- **不做**：不含任何具体工具

### tools/core/ToolRegistry.ts
- **职责**：注册、查找、执行工具；收集 prompt section
- **对外接口**：`ToolRegistry` 类
- **不做**：不执行沙箱（那是 JsRunner）

### tools/core/ToolResult.ts
- **职责**：统一工具返回结构
- **对外接口**：`ToolResult.success()` / `.error()`
- **不做**：不格式化输出（由各工具负责）

### tools/runtime/JsRunner.ts
- **职责**：在 vm 沙箱执行 AI 生成的 JS，通过 hostBridge 回调工具
- **对外接口**：`JsRunner` 类（`run(code, ctx)`）
- **不做**：不注册工具、不决定工具列表

### tools/runtime/host-bridge.ts
- **职责**：沙箱 ↔ 工具注册表 的桥接（序列化、超时、错误包装）
- **对外接口**：`createHostBridge(registry)`
- **不做**：不含 JS API 定义（那是 `runtime/js-api.ts`）

### tools/runtime/js-api.ts
- **职责**：定义沙箱内暴露给 AI 的 JS API（`read`/`write`/`readFile`/…）
  到工具名的映射，及沙箱 bootstrap 脚本
- **对外接口**：`buildSandboxApi()` / `BOOTSTRAP_SCRIPT`
- **不做**：不执行代码（执行在 JsRunner）
- **说明**：旧别名（`readFile`/`writeFile`/`editFile`）的增删在此集中管理

### tools/impl/*.ts
- **职责**：单个工具的实现（一个文件一个工具）
- **对外接口**：导出工具类
- **不做**：不做跨领域的隐式耦合；**允许同族工具间复用纯函数**
  （如 `read-lines.ts` 复用 `read.ts` 的 `parseReadArgs`）

### tools/index.ts
- **职责**：单一注册入口 —— 创建 registry、注册所有工具、导出
- **对外接口**：`registry` / `JsRunner` / 各工具类
- **不做**：不含工具实现

### tools/api.d.ts
- **职责**：给 AI 的 JS API 契约（原 estrix-tools.d.ts）
- **对外接口**：类型声明
- **不做**：不含运行时代码

---

## session/ —— 会话与项目上下文

### session/store.ts
- **职责**：会话 ↔ 目录映射的持久化（每 profile 一份）
- **对外接口**：`createSessionStore(profileId, dir)`
- **不做**：不知道窗口、不读 provider

### session/project-context.ts
- **职责**：初始化项目 —— 选目录、拼系统提示词、通过 IPC 发给渲染进程
- **对外接口**：`initProject(opts)`
- **不做**：不实现模板变量替换（用 prompt-render）、不实现 IPC 通道（在 app/ipc）

### session/compaction.ts
- **职责**：上下文压缩流程（摘要 → share API → 跳转）
- **对外接口**：`runCompaction()`
- **不做**：不做 DOM 抓取（用 bridge）、不直接发消息（用 overlay/chat-input）

---

## bridge/ —— 与 AI 网页的桥接

### bridge/entry.ts
- **职责**：preload 初始化时序 —— 注入样式 → 绑事件 → 启动各引擎
- **对外接口**：副作用式（执行即初始化）
- **不做**：不含业务逻辑

### bridge/api.ts
- **职责**：暴露 `electronAPI` 给渲染进程
- **对外接口**：挂到 window / contextBridge
- **不做**：不含业务逻辑

### bridge/intercept/observer.ts
- **职责**：监听主世界 `estrix-ai-response` 事件，驱动工具流程
- **对外接口**：`startInterceptObserver()` / `onInterceptedResponse(cb)`
- **不做**：不做 DOM 抓取（那是 dom-observe）、不解析（那是 parser）

### bridge/intercept/injector.ts
- **职责**：把 provider 的 hook 源码注入主世界
- **对外接口**：`injectHook(provider)`
- **不做**：不含 hook 源码（在 providers）

### bridge/parser/js-detector.ts
- **职责**：从 AI 回复里识别 estrix 代码块（JS 调用）
- **对外接口**：`looksLikeToolScript(code)` / `extractJsToolBlocks(text)`
- **不做**：不执行

### bridge/parser/json-detector.ts
- **职责**：识别 AI 是否在用**旧的 JSON 调用格式**（`{"toolName":...}`）
- **对外接口**：`looksLikeJsonToolCall(text)`
- **不做**：**不解析、不执行** JSON 调用
- **说明（D11）**：JSON 模式已废除。检测到 JSON 调用时，
  只发"工具规范已更新"章节提醒 AI 改用 JS 模式，
  **不发完整初始化提示词**（避免重置项目目录 / MCP 状态）。

### bridge/loop/executor.ts
- **职责**：JS 脚本的执行分发、结果回传
- **对外接口**：`handleJsToolScript()`
- **不做**：不处理 JSON 调用（已废除）、不决定重试（那是 retry）

### bridge/loop/watchdog.ts
- **职责**：AI 卡住时催继续
- **对外接口**：`startSessionWatcher()` / `arm()` / `disarm()`
- **不做**：不重试失败（那是 retry）

### bridge/loop/retry.ts
- **职责**：请求失败时按退避重发
- **对外接口**：`startRetryEngine()`
- **不做**：不催卡住（那是 watchdog）

---

## overlay/ —— 纯 UI

### overlay/template.ts
- **职责**：覆盖层的 HTML/CSS 字符串
- **对外接口**：`OVERLAY_HTML` / `OVERLAY_CSS`
- **不做**：不含逻辑

### overlay/panel.ts
- **职责**：覆盖层基础能力 —— 注入、显隐、toast、徽章、历史
- **对外接口**：`injectOverlay()` / `showToast()` / `setTaskStatus()` 等
- **不做**：不执行业务、不调 IPC（除必要）

### overlay/events.ts
- **职责**：覆盖层所有按钮/表单事件绑定
- **对外接口**：`bindEvents(handlers)` —— handlers 为回调集合
- **不做**：不含业务实现；**不 require bridge/session**（通过回调注入触发业务）
- **⚠️ 813 行，需按面板区域拆成多个子文件**

### overlay/chat-input.ts
- **职责**：聊天输入框读写（React 兼容）、发送文本、把工具结果写入并发送
- **对外接口**：`sendToChat(text)` / `sendToolResultToChat(result)`
- **不做**：不解析回复；不含"何时该回填"的决策（由 bridge 决定后调用）

### overlay/session-list.ts
- **职责**：会话列表渲染与导航
- **对外接口**：`renderSessions()` / `handleInitProject()`
- **不做**：不管理会话存储

### overlay/project-dir.ts
- **职责**：项目目录显示与修改按钮
- **对外接口**：`initProjectDirSection()`
- **不做**：不实际切目录（走 IPC）

---

## app/ —— 应用外壳

### app/entry.ts
- **职责**：应用启动 —— 创建窗口、注册 IPC、生命周期钩子
- **对外接口**：副作用式
- **不做**：不含业务

### app/window.ts
- **职责**：窗口 ↔ profile 上下文映射表
- **对外接口**：`addWindow()` / `getContextByWebContents()` 等
- **不做**：不创建窗口（entry 创建）

### app/profile.ts
- **职责**：profile 增删改查、持久化
- **对外接口**：`createProfile()` / `listProfiles()` 等
- **不做**：不创建窗口

### app/ipc/*.ts
- **职责**：IPC 通道按领域拆分（project / session / command / tool）
- **对外接口**：`registerXxxHandlers()`
- **不做**：不含业务实现（转调 session / tools）

---

## mcp/ —— MCP 集成

### mcp/client.ts
- **职责**：MCP server 连接管理（stdio/HTTP）、工具列表、调用
- **对外接口**：`connect()` / `listServers()` / `call()`
- **不做**：不读配置（用 config）

### mcp/config.ts
- **职责**：mcp.json / mcp-state.json 读写
- **对外接口**：`readConfig()` / `writeConfig()` / `readState()`
- **不做**：不连接

---

## updater/

### updater/index.ts
- **职责**：检查/下载/安装更新
- **对外接口**：`checkForUpdates()` / 事件
- **不做**：不弹 UI（由渲染进程显示）

---

## 已删除模块

| 现状 | 处置 |
|---|---|
| `src/main/tool-registry.js` | 删除，逻辑并入 `tools/index.ts` |
| `src/preload/tool-names.js` | 删除，白名单从 registry 动态生成 |
| `src/preload/dom/state.js` | 拆解，状态归属各领域模块 |
| `tools/GlobTool.js` / `GrepTool.js` | 删除（旧版，P1） |
| `tools/FileReadTool.js` / `FileWriteTool.js` / `FileEditTool.js` | 视 D4 决策（P1 或 P5 删） |

---

## 待定：模块间「共享状态」的归属

> ⚠️ 本节为**初步设想**，非定论。状态如何拆分强依赖具体代码，
> 将在 **P4 拆解 `state.js` 时结合代码细化**。此处仅记录方向。

现状 `dom/state.js` 是个杂物篮，需按内容归属（初步方向）：

| 现状字段 | 归属 |
|---|---|
| `initialPromptContent` | session/project-context |
| `pendingInitialPrompt` | session/project-context |
| `pendingToolCall` | bridge/loop/executor |
| `sendDelayMin/Max` | overlay/chat-input（配置） |
| `currentProjectDir` | session/project-context |
| `serverTokenUsage` | session（token 统计） |
| `lastResponseMsgIds` | bridge/intercept/observer |

⚠️ 拆解时注意：这些字段被多模块读写，需改为显式传参或每模块自己的状态。
