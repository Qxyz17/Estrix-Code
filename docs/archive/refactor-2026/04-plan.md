# Estrix Code 重构计划

> 状态：✅ **已完成**（P0–P5 全部结束，2026-09-20）
> 配套：`01-architecture.md` / `02-modules.md` / `03-decisions.md`
> 原则：每阶段可独立验证；每 PR 只做一件事；测试全绿才进下一步。

> **最终成果**：全仓 TypeScript（主应用 `strict`）+ ESM + 依赖升级；
> 按领域重组目录；工具 API 契约自动生成；窗口地址栏；
> 208+ 测试全绿、typecheck 0 错误。详见 `CHANGELOG.md`。

---

## 总览

| 阶段 | 目标 | 时长 | 风险 |
|---|---|---|---|
| P0 | 定义边界（文档） | 1 周 | 零 |
| P1 | 清理死代码 | 1-2 周 | 低 |
| P2 | TS 基建 + 依赖护栏 | 1 周 | 低 |
| P3 | TS 渐进迁移 | 2-4 周 | 中 |
| P4.1 | 主进程拆分（已完成） | — | 中 |
| P4 | 按新边界重构 | 4-8 周 | 高 |
| P5 | 收紧与收尾 | 1 周 | 低 |

**里程碑**：P2 结束时可随时暂停（有 TS 基建，代码仍可用）；P3 结束时代码全 TS；P4 结束达到目标架构。

---

## P0 —— 定义边界（当前阶段）

**目标**：产出架构文档，不写代码。

**任务**：
- [x] `01-architecture.md` —— 目标架构
- [x] `02-modules.md` —— 模块职责表
- [x] `03-decisions.md` —— 决策记录（D1–D15 全定）
- [x] `04-plan.md` —— 本文件
- [x] 用户 review 全部文档
- [x] 拍板 D3 / D4 / D5 / D10
- [ ] 补齐 `00-goal.md`（用户口述目标）

**验收**：用户对架构与模块划分认可；所有阻塞决策有结论。

**注意**：本阶段**不动任何源码**。

---

## P1 —— 清理废弃路径

**目标**：清理旧工具 / 旧别名 / 冗余，**不新增功能、不重构结构**。

> ⚠️ 与旧版定义的差异：本阶段**接受"删废弃路径"带来的行为变更**
> （如 JSON 模式调 file_glob 会失败、readFile() 会报错）。
> 这些路径本就是 D4/D11 要废除的；"行为不变"的原意是"不改业务逻辑"，
> 而非"一个字节都不能动"。**这里提前删，为 P3 迁移减量。**

**任务**：
- [ ] 删 `tools/GlobTool.js` + `tools/GrepTool.js`（file_glob/file_grep 旧工具）
- [ ] 删 `test/tools/LegacyGlobGrep.test.js`
- [ ] 清理 `tools/index.js` 对应 import/register/export
- [ ] 清理 `src/preload/tool-names.js` 的 `file_glob`/`file_grep`
- [ ] **修 bug**：`tool-names.js` 缺 `mcp_call`
- [ ] 删旧别名与对应工具（D4：`readFile`/`writeFile`/`editFile`/`readFileWithLines`
      及 `FileReadTool`/`FileWriteTool`/`FileEditTool`）
- [x] 提示词组织：机制已存在（provider.getPromptTemplate 优先，文件兜底），无需改动（D5）
- [ ] 清理根目录生成文件（`build-*.log`、`coverage.lcov` 等）出 git

**验收**：
- `node --test` 全绿（**需同步删/改受影响的测试**）
- 源码行数下降（目标 -10%）
- `estrix-tools.d.ts` **按 D4 更新**（删旧别名条目）
- 应用能 `npm start` 启动并完成一次工具调用

**风险**：
- 误删被动态引用的代码 → 每次删除后立刻跑测试
- 测试失败是**预期**（测试引用了将删的工具）→ 同步更新测试，而非视为回归

---

## P2 —— TS 基建 + 依赖护栏

**目标**：引入 TS，但不改任何源码逻辑。

**任务**：
- [ ] 装依赖：`typescript` / `@types/node` / `@types/electron`（或 electron 自带）
- [ ] `tsconfig.json`：`allowJs: true`、`checkJs: false`、`strict: false`、`noEmit: true`
- [ ] 加脚本：`npm run typecheck` = `tsc --noEmit`
- [ ] 引入 ESLint + `import/no-restricted-paths`（D8）
- [ ] CI 加 typecheck + lint（`.github/workflows/`）
- [ ] 处理 `tools/estrix-tools.d.ts` 与 tsconfig 的关系

**验收**：
- `npm run typecheck` 通过（此时只有 `.d.ts` 和 `.js`，无报错）
- 写一个违规 import（如 infra 引 tools）→ ESLint 报错
- 测试全绿（未动源码）

**风险**：TS 与 Electron 类型冲突 → 用 `skipLibCheck` 兜底。

---

## P3 —— TS 渐进迁移

**目标**：把 `src/` 与 `tools/` 全迁 TS，**行为不变**。

**顺序（叶子 → 根）**：
1. `infra/`（无依赖）
2. `providers/`
3. `tools/core/` + `tools/impl/`（先简单工具，后 JsRunner）
4. `session/`
5. `bridge/parser/`（纯函数，易迁）
6. `bridge/loop/` + `bridge/intercept/`
7. `overlay/`
8. `app/`
9. `mcp/` + `updater/`

**每文件迁移流程**：
1. 重命名 `.js` → `.ts`
2. 加最小类型标注（允许 `any`）
3. `tsc --noEmit` 通过
4. 测试全绿
5. 一个 commit

**验收**：
- 所有 `src/**/*.js` 变为 `.ts`
- `tsc --noEmit` 通过
- 测试全绿
- 应用可正常启动、工具可正常调用
- 每个文件一个 commit，可逐步回滚

**风险**：
- 循环依赖暴露 → 就地小修，不扩大
- 动态 require（如 `require('../providers')`）→ 显式类型
- Electron 的 renderer/main 类型差异 → 用 `process.type` 判断分支

---

## P4 —— 按新边界重构

**目标**：达到 `01-architecture.md` 的目标结构。

**分 5 个子阶段，每阶段独立可交付**：

### P4.1 主进程拆分 ✅
- [x] `src/main/index.js` → `src/app/entry.ts`（+ `infra/paths.ts` 已于 P3b 建立）
- [x] `src/main/ipc.js` → `src/app/ipc/{project,session,command,tool,renderer}.ts`
- [x] `src/main/window.js` → `src/app/window.ts`
- [x] `src/main/profile-manager.js` → `src/app/profile.ts`
- [x] 其余 main 文件按映射表归位：
      `session-store→session/store`、`project-context→session/project-context`、
      `mcp-client→mcp/client`、`mcp-config→mcp/config`、`updater→updater/index`、
      `dangerous-commands→infra`、`with-log→infra`、删 `tool-registry`（并入 tools/index）
- [x] `package.json main` → `out/src/app/entry.js`
- **结果**：`src/main/` 与 `src/utils/` 已清空；typecheck/vitest/lint 全绿；真机验证通过

### P4.2 preload 归位
**B 步（文件归位）✅ 完成（ba26cc6）**：`src/preload/` 已清空
- [x] `dom/*` → `bridge/**`（intercept/parser/loop）或 `overlay/**`
- [x] `overlay/*` → `overlay/**`（panel/template/events/project-dir）
- [x] `dom/compaction` → `session/compaction`
- [x] `index.ts` → `bridge/entry.ts`、`api` → `bridge/api`、`tool-names` → `bridge/tool-names`
- [x] `state.ts` → `overlay/state.ts`（暂作共享）

**A 步（回调注入解耦）✅ 完成（db39e6a + b78cd3e）**
- [x] `overlay → bridge` 硬依赖清零（回调注入 wireChatInput/wireEvents）
- [x] `BT/FENCE` 提取到 `infra/markdown`（共享常量）
- [ ] state 跨层字段改推送（`serverTokenUsage`/`lastResponseMsgIds`）
- [ ] `bridge/tool-names` 删除（**推迟 P5**：需 D12 构建期生成，不能在 preload 引主进程 registry）
- [ ] `test/preload/` 改名（源码已不在 preload）

### P4.3 tools 重组 ✅（23383b9）
- [x] `tools/` → `src/tools/`（根目录 tools/ 已删）
- [x] 按 `core/`（Tool/ToolRegistry/ToolResult）、`runtime/`（JsRunner）、`impl/`（各工具）重组
- [x] `ToolRegistry.ts` 拆为 3 文件（B 方案）
- [x] impl 文件名改 kebab-case（read.ts/write.ts/bash.ts...）
- [x] `decodeOutput` → `src/infra/decode-output.ts`
- [x] `estrix-tools.d.ts` → `src/tools/api.d.ts`
- [x] 同步改 package.json（extraResources）、tsconfig、eslint、vitest、paths.ts、测试
- **验收**：typecheck ✅ / 218 测试 ✅ / compile ✅ / lint 0 error

### P4.4 providers 对齐新约定（D13/D14/D15）✅
- [x] `providers/types.ts`（原 provider.d.ts 提升为真类型模块）+ `validate.ts`（D14，内置也过校验）
- [x] `index.ts` → `registry.ts`
- [x] 自定义 provider 加载过 validate（D15）
- [x] 删 `custom/provider.d.ts`
- **注**：D13「单文件自包含」在 P4.4.1 被**修正**——hook 因序列化约束，
      改为 `hooks/*.ts`（正常模块）+ 构建期 esbuild 打包成自包含 IIFE

### P4.4.1 hook 模块化 ✅（P4.4 衍生，76edc6a/b2ffb0a/9a74614）
**问题**：hook 经 `.toString()` 注入主世界，序列化只含函数体 → 内部 SSE 解码
三平台各复制一份。架构文档"抽 shared/sse.ts"因该约束**不可行**。
**方案**：hook 写成正常 TS 模块（可 import），构建期 esbuild bundle 成自包含 IIFE 字符串。
- [x] `hooks/shared/sse.ts`（createFrameDecoder/extractData/parseBlock）
- [x] `hooks/deepseek.ts` / `hooks/claude.ts` / `hooks/chatgpt.ts`
- [x] `scripts/build-hooks.mjs`（esbuild bundle → `generated/hook-sources.ts`）
- [x] `compile` 脚本先 build-hooks 再 tsc
- [x] provider 的 `getHookSource()` 返回生成的常量
- **效果**：deepseek 574→110、claude 299→86、chatgpt 379→123 行

### P4.5 拆分与模式收敛
- [x] **废除 JSON 调用模式（D11）** ✅（47267bd）：`json-detector` 改为只识别
      （`looksLikeJsonToolCall`）+ 发提示；删 `handleToolCall`/`sendToolResultToChat`/
      `tool-names`（净减 390 行）
- [x] **工具命名统一（B1）** ✅（ce1bd00）：registry name / JS API / section 名
      **三者全 camelCase 一致**（18:18:18）；参数名 `file_path`→`filePath`、
      `old_string`→`oldString`；删 `__bash` 冗余（与 `BashTool` 重复）
- [x] `overlay/template.ts` → 外置 `.html`/`.css`（②B，397ca65）：构建期生成
      `template.generated.ts`
- [x] `overlay/events.ts` 拆分（f901a2e，819→330 行）：`panels/window-manager`、
      `panels/mcp-manager`、`panels/settings`、`fab.ts`；`events.ts` 保留编排
- [x] `session/project-context.ts` 拆分（81e5191，289→150 行）：
      提示词组装抽出到 `session/prompt-builder.ts`

**B1 的架构价值**：一个工具一个名字 → `getPromptSection` 可写 `'tool:' + this.name`，
`JsRunner` 无需 snake↔camel 翻译 → **为 P5 的 D12（工具规范自动生成）铺路**。

**验收（每子阶段）**：
- ESLint 依赖规则零违规
- 测试全绿
- 应用功能不回归（手动冒烟关键路径）
- 目录结构与文档一致

**风险**：这是最长的阶段。D10 决定不冻结 master，重构分支需定期合并，
冲突就地解决。

---

## P5 —— 收紧与收尾

**目标**：提升质量，清理残留。

**任务**：
- [x] `tsconfig` 开 `strict: true`（c5c444e）：主应用 0 错误；
      hook 独立类型环境（`tsconfig.hooks.json`，承认 hook 是注入脚本这一不同性质）
- [x] **工具规范自动生成（D12）** ✅（984f648 + d335e23）：
      - 18 个工具自持 `apiMetas` 元数据（doc/params/types/paramDocs 等）
      - `scripts/build-tool-api.mjs` 构建期生成 `src/tools/api.d.ts`（AI 契约）
      - 18 个工具自持 `bootstrap()` 函数（沙箱注入），构建期 `.toString()` 提取
        生成 `src/tools/runtime/bootstrap.generated.ts`
      - `JsRunner` 用 `TOOL_BOOTSTRAP` 组装（删 90 行手写注入）
      - **工具成为唯一真相源**：改工具 → api.d.ts + bootstrap 自动同步
- [x] 删残留的兼容层/旧别名：无 `@ts-ignore`、无 TODO；`_legacy` 旧测试已清理
- [x] 补关键路径测试（bootstrap-consistency 集成测试）
- [x] 更新 `README`（项目结构）/ `CHANGELOG`（重构条目）
- [x] 消除 bridge/session → overlay 反向依赖（8422a9d）
- [x] 更新 `docs/refactor/` 状态为「已完成」
- [x] 归档本目录到 `docs/archive/refactor-2026/`

**验收**：
- `strict` 通过
- 无死代码（用工具扫）
- 测试覆盖率达标
- 文档与代码一致

---

## 全程纪律

1. **每 PR 只做一件事** —— 不混合迁移与重构。
2. **测试全绿才合并** —— 红了立刻回滚，不带病前进。
3. **契约变更记录** —— 改 `estrix-tools.d.ts` 必须更新 `03-decisions.md`。
4. **阶段边界暂停** —— P1 / P2 / P3 结束都是「可交付点」，可暂停。
5. **每周进度报告** —— 阶段内每完成一批任务出一份简报。

---

## 当前行动

✅ **重构全部完成**（P0–P5）。

- 本目录已归档至 `docs/archive/refactor-2026/`
- 后续开发请以当前代码结构为准（见 `README.md` 项目结构段）
