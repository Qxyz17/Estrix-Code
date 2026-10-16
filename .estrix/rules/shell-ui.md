---
name: shell-ui
paths:
  - "src/ui/shell/**/*"
  - "src/ui/shell.html"
---

# 壳页面（shell UI）规则

## ⚠️ shell.html 是生成物，别手改

- **真源**：`src/ui/shell/` 目录
  - `index.html` —— 骨架（用 `<!--@include:partials/xxx.html-->` 组装）
  - `partials/` —— 各页 HTML 片段
  - `scripts/` —— 各页 TS（esbuild 打包进 `//@bundle` 处）
  - `styles/` —— CSS（组装进 `<style>`）
- **生成物**：`src/ui/shell.html`（由 `scripts/build-shell.mjs` 生成）
- **改 UI 的正确姿势**：改 `src/ui/shell/**` → 跑 `node scripts/build-shell.mjs`（或 `npm run compile`）→ 自动重建 `shell.html`
- **禁止**：直接改 `src/ui/shell.html`（会被下次构建覆盖）

## 依赖与分层

- `scripts/` 下各模块通过 `shared.js` 拿 `shellAPI`（preload 注入）；**不直接 import electron**。
- UI 状态（展开/宽度等）存 `localStorage`；跨窗口通信走 `window.shellAPI.*`（IPC）。

## 样式规范

- 颜色**只用 CSS 变量**（`--ck-*`），见 `docs/ui-design.md`
- 滚动条**全局统一**（`base.css` 顶部定义），**别逐个元素写**
- 改完跑 `npm run compile`（会重建 `shell.html`）
