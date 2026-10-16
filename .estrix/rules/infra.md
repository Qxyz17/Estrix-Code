---
name: infra
paths:
  - "src/infra/**/*.ts"
---

# infra 层规则

infra 是**最底层**，不得依赖任何上层。

- ❌ 不可 import `providers/tools/bridge/session/app/overlay`
- ✅ 只可用 node 内置模块（`node:fs`、`node:path` 等）
- 改动时确认没引入上层 import
