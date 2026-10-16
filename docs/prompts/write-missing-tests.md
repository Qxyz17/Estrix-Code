# 任务：补两处遗漏的单元测试

前一轮补测试遗漏了两个模块，本次补齐。**严格遵守 `.estrixCode/ESTRIX.md` 的约束（尤其"任务纪律"与"收尾报告"）。**

## 待补模块

### 1. `src/session/prompt-builder.ts` → `test/session/prompt-builder.test.js`

导出：`PROMPT_DIR`、`loadTemplate(providerId)`、`buildPrompt({ providerId, selectedDir, isCompaction })`

要覆盖：
- `loadTemplate` 的模板选择优先级（provider.getPromptTemplate() > `src/prompt/{id}.md` > `default.md`）
- 未知 providerId 回退 default.md
- 不存在的模板 → 返回 `error`（失败路径）
- `buildPrompt` 的占位符替换：`{{TOOLS_LIST}}`、`{{TOOL_SECTIONS}}`、`{{PLATFORM_INFO}}`、`{{PROJECT_DIR}}`、`{{MCP_SECTION}}`、`{{TOOL_API_TYPES}}`、`{{PROJECT_INTRO_SECTION}}`
- `isCompaction: true` 时末尾追加"请继续你之前的工作"
- 读不到 `.estrixCode/ESTRIX.md` 时 `{{PROJECT_INTRO_SECTION}}` 为空（用临时目录测）
- **失败路径**：模板文件不存在、目录不存在

注意：`buildPrompt` 会调用 MCP/tools/registry，**难以完全隔离**——若某部分强依赖运行时，**标注"需真机验证"并跳过**，不要硬 mock 内部模块。优先测能测的（模板选择、占位符替换）。

### 2. `src/providers/registry.ts` → `test/providers/registry.test.js`

导出：`providers`（数组）、`getProvider(id)`、`getAllProviders()`、`getProviderByUrl(url)`

要覆盖：
- `getAllProviders()` 返回非空数组，含内置平台（deepseek/claude/chatgpt）
- `getProvider('deepseek')` 返回对应 provider；未知 id 返回 falsy（失败路径）
- `getProviderByUrl` 按 URL 匹配：
  - `https://chat.deepseek.com/...` → deepseek
  - `https://claude.ai/...` → claude
  - `https://chatgpt.com/...` → chatgpt
  - 未知 URL → falsy / null（失败路径）
  - 空字符串 / null（失败路径）

## 硬要求

1. **先列 todoWrite**（两个模块 = 两项），做一项勾一项
2. **不 mock 内部模块**（见 `.estrixCode/ESTRIX.md` 第六节）；模拟 `window`/`document`/`localStorage` 等外部边界是允许的
3. **优先失败路径**
4. 每加一个文件，立即验证：
   ```bash
   npm run typecheck
   npm test
   npm run lint
   ```
   全绿再继续
5. 每模块单独提交：`test(session): ...` / `test(providers): ...`

## 收尾必须交报告（硬要求）

按 `.estrixCode/ESTRIX.md` 第三节，说明：
1. **做了什么**（新增文件、用例数）
2. **没做什么**（若某部分跳过，写明原因）
3. **验证结果**（typecheck/test/lint 是否全绿）
4. **后续建议**
