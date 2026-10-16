---
name: tools
paths:
  - "src/tools/**/*.ts"
---

# tools 层规则

## D12 工具契约（唯一真相源）

加/改工具只改 `src/tools/impl/*.ts`，**契约自动生成**：
- `apiMetas` → `src/tools/api.d.ts`
- `bootstrap()` → `src/tools/runtime/bootstrap.generated.ts`

**名字四处必须一致**：`apiMetas.name` = `super()` 首参 = `bootstrap` 里 `__call` 首参 = `globalThis.xxx`

## 依赖铁律

tools **不可** import `bridge/overlay/session/app`；需要下层能力用**注入**（如 `injectAgentRunner`）。

## 禁改生成物

`api.d.ts`、`bootstrap.generated.ts` 是**构建期生成**，改真源、跑 `npm run compile`。
