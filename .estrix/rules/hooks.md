---
name: hooks
paths:
  - "src/providers/hooks/**/*.ts"
---

# provider hook 规则

hook 会被**打包成自包含 IIFE**，注入 AI 网页**主世界**。

- ✅ **必须自包含**：可 import `./shared/sse.js`（esbuild 内联），但不能有外部运行时依赖
- ❌ **不用复杂 TS 类型**（在 `tsconfig.hooks.json`，非 strict）
- 改动后 `npm run compile` 重新生成 `hook-sources.ts`
- 加新 hook 要注册到 `scripts/build-hooks.mjs` 的 HOOKS 数组
- **只能真机验证**（注入主世界，单测覆盖不到）
