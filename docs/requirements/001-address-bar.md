---
id: 001
type: feature
title: 窗口地址栏
status: done
branch: feat/address-bar
created: 2026-09-20
updated: 2026-09-21
---

## 背景

窗口直接加载 AI 网页，没有地址栏，无法：
- 复制当前 URL
- 粘贴网址跳转
- 前进 / 后退 / 刷新

## 目标

每个窗口顶部有一条地址栏，支持显示当前 URL、复制、粘贴跳转、前进后退刷新主页。

## 方案

采用 **WebContentsView 架构**，而非"在页面上注入地址栏"：

- 壳窗口：`BrowserWindow.webContents` 加载 `src/ui/shell.html`（地址栏 UI），preload 为 `src/app/shell-preload.ts`
- AI 页面：放在 `WebContentsView` 中，占地址栏下方全部区域，preload 仍为 `src/bridge/entry.ts`

**关键改动**：窗口上下文 `WindowContext` 增加 `view` 字段；所有"操作 AI 页面"的代码从 `ctx.win.webContents` 改为 `ctx.view.webContents`（涉及 `entry.ts` / `store.ts` / `project-context.ts` / `attach-file.ts` / `ipc/session.ts`）。

## 验收标准

- [x] 窗口顶部显示地址栏（44px）
- [x] 显示当前 URL（随页面导航更新）
- [x] 可选中/复制 URL
- [x] 粘贴网址回车跳转
- [x] 前进 / 后退 / 刷新 / 主页按钮
- [x] 对话、工具调用、附件上传等功能不回归

## 遗留 / 后续

- 无前进/后退时的按钮禁用态已实现
- 未做：书签、历史下拉、缩放控制
