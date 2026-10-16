---
id: 017
type: feat
title: 快捷提示词（Snippets）——「提示词」页
status: in_progress
branch: feat/017-snippets
created: 2026-09-29
updated: 2026-09-29
---

## 背景

侧边栏「工具」页现有的三个按钮（生成项目说明 / 沉浸式交流 / 卡住了?点我）本质都是
**固定提示词**。用户希望把它升级为可自定义的**快捷提示词（snippets）**：
- 内置 3 条默认，首次写入用户配置后完全归用户管（可增/删/改）
- 用户可自行添加提示词
- 点击后：填入 AI 输入框（光标停末尾）+ 可选自动发送

## 目标

- 侧边栏「工具」页 → 改名「**提示词**」页（图标改）
- 数据模型：用户级 \`~/.estrix/snippets.json\`，首次写入 3 条默认，之后用户可增删改
- 每条 snippet：\`{ id, name, content, autoSend }\`（autoSend 默认 true）
- 点击行为：把 content 填入 AI 输入框 + **光标停末尾**；autoSend=true 时自动发送，false 时只填入
- 管理：列表 + 添加/编辑/删除
- 「窗口管理」「MCP」按钮从「工具」页移除（窗口管理已有独立标签；MCP 将做独立页面）

## 方案

### 数据层
- 新建 \`src/app/snippets.ts\`：读写 \`~/.estrix/snippets.json\`
  - \`listSnippets()\`：读；文件不存在则写入 3 条默认并返回
  - \`saveSnippets(list)\`：整体覆盖写
  - 3 条默认（原文取自现有实现）：
    1. 生成项目说明：\`根据当前项目生成一个类似 claude.md 的项目说明文件，并将文件放到当前项目 .estrix/ESTRIX.md\`（autoSend: true）
    2. 沉浸式交流：\`现在你的任何疑问,或没有疑问的选择都需要和我确认 , 确认的方式是 你问一个问题我回答一个问题,然后你再问下一个问题, 最好给我选项, 也要给我个其他的选项, 谢谢 爱你哦\`（autoSend: true）
    3. 卡住了?点我：\`刚才卡住了请继续 爱你哦\`（autoSend: true）

### IPC 层
- 新建 \`src/app/ipc/snippets.ts\`：
  - \`list-snippets\` → \`{ success, snippets }\`
  - \`save-snippets\` \`{ snippets }\` → 整体覆盖
  - \`trigger-snippet\` \`{ content, autoSend }\` → 主进程往 AI 页面 view 发 \`estrix-trigger-snippet\`
- \`src/app/entry.ts\` 注册

### AI 页面（bridge/overlay）
- \`src/overlay/chat-input.ts\`：新增 \`insertSnippet(content, autoSend)\`
  - \`setInputContent(input, content)\` → 光标移到末尾 → autoSend ? \`triggerSend(input)\` : 不发
- \`src/bridge/entry.ts\`：监听 \`estrix-trigger-snippet\` → 调 \`insertSnippet\`

### 壳页面
- \`src/app/shell-preload.ts\`：加 \`listSnippets / saveSnippets / triggerSnippet\`
- \`src/ui/shell.html\`：
  - 活动栏「工具」→「提示词」（图标改）
  - 面板：列表（每条：名称 + 编辑/删除 + 点击执行）+ 添加按钮
  - 编辑弹层（名称 + 内容 + 自动发送开关）

## 验收标准

- [ ] 「工具」页改名「提示词」，图标更换
- [ ] 首次打开含 3 条默认，写入 \`~/.estrix/snippets.json\`
- [ ] 点击 → 填入输入框 + 光标末尾；autoSend=true 自动发送
- [ ] autoSend=false 只填入不发送
- [ ] 可添加 / 编辑 / 删除
- [ ] 重启后配置保留
- [ ] typecheck / test / lint / compile 全绿
- [ ] 真机验证

## 遗留

- MCP 独立页面（另行需求）
- 旧 overlay 的 3 个按钮（生成文档/沉浸式/卡住了）待清理
