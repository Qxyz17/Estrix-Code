---
id: 019
type: feature
title: 飞书同步（手机收发对话）
status: doing
branch: feat/019-feishu-sync
created: 2026-09-30
updated: 2026-09-30
---

## 背景

用户希望在手机上通过 IM（本次先做**飞书**）跟进与 AI 的对话：电脑上跑的 Estrix，AI 的回复/工具状态推到飞书；手机在飞书里发消息也能送进 Estrix 发给 AI。

## 目标

- **推送方向（Estrix → 飞书）**：
  - 用户消息（**仅经 Estrix 发送的**：输入框经 sendToChat / 快捷提示词 / 飞书发来）
  - AI 文本回复（完成时；可选流式，先只发最终）
  - 工具调用**只发两条状态**：「AI 正在调用工具」/「工具调用完成」（**不发工具名、参数、结果**——隐私，工具名默认不发，可配置）
- **接收方向（飞书 → Estrix）**：手机发来的文本 → 送到当前活跃窗口 → 发给 AI（等同 Estrix 输入）
- **配置界面**：侧边栏新增独立「飞书」页（像 MCP 页），含凭证（App ID/Secret）、开关、连接状态、收发选项
- **连接方式**：飞书官方 SDK 长连接（无需公网 IP）

## 方案

### 依赖
- `@larksuiteoapi/node-sdk`（官方 SDK，封装长连接/鉴权/消息收发）

### 新增文件（独立，尽量零耦合）
| 文件 | 职责 |
|---|---|
| `src/feishu/client.ts` | 飞书客户端：长连接、收发消息、token 管理（主进程内存） |
| `src/feishu/config.ts` | 凭证/开关读写（用户级 `~/.estrix/feishu.json`） |
| `src/app/ipc/feishu.ts` | IPC：配置读写、启停、状态查询 |
| `src/bridge/feishu-bridge.ts` | bridge 侧：上报用户消息/AI 回复/工具状态；接收飞书来消息 |

### 对现有文件的改动（向后兼容的新增）
| 文件 | 改动 |
|---|---|
| `src/app/entry.ts` | 初始化 feishu（若已配置） |
| `src/app/ipc/index.ts` | 注册 feishu IPC |
| `src/bridge/entry.ts` | 激活 feishu-bridge |
| `src/ui/shell.html` | 新增「飞书」页 + 活动栏图标 |
| `src/app/shell-preload.ts` | 暴露 feishu API |

### 数据流
```
【推】AI 页面(bridge) 捕获消息/工具事件 → feishu-bridge → IPC → 主进程 → 飞书 API → 手机
【收】手机发飞书消息 → 飞书长连接 → 主进程 → IPC → 活跃窗口 AI 页面 → sendToChat → 发给 AI
```

## 验收标准

- [ ] 侧边栏「飞书」页：填 App ID/Secret、开关、连接状态、收发选项
- [ ] 配置后长连接成功（状态显示"已连接"）
- [ ] Estrix 发消息 → 飞书收到
- [ ] AI 回复 → 飞书收到
- [ ] 工具调用 → 飞书收到两条状态（不带工具名/参数/结果）
- [ ] 飞书发消息 → Estrix 当前窗口发给 AI
- [ ] 断开/关闭后不占资源
- [ ] typecheck / test / lint / compile 全绿
- [ ] 真机验证（需飞书账号 + 应用）

## 遗留

- 多平台（钉钉/企微）后续扩展
- 流式输出推送（先只发最终）
- 多窗口选择（先只发当前活跃窗口）
