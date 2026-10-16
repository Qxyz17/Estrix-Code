---
name: bridge
paths:
  - "src/bridge/**/*.ts"
---

# bridge 层规则

bridge 是 preload（与 AI 网页桥接）。

- ❌ 不可 import `session/`、`app/`
- ✅ 可依赖 `infra/providers/tools/overlay`
- **不读写 `overlay/state.ts`**——数据经**回调推送**（`onInterceptedResponse` 等）
- 操作 AI 页面用 `view.webContents`
