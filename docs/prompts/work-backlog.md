# 任务提示词：处理待办清单（Backlog）

> 用法：新开 AI 对话时，把本文件 + 你想做的那一条（或几条）一起发给 AI。

---

## 你的第一步：先读

1. `docs/backlog.md` —— 待办清单（**找到你要做的那条**）
2. `docs/architecture.md`（及 `docs/arch/` 分册）—— 了解系统怎么工作
3. `.estrixCode/ESTRIX.md` —— 项目约束（**必须遵守**）

## 你的第二步：判断任务类型

| 类型 | 处理方式 |
|---|---|
| **新功能 / 行为变更 / 多文件** | 建需求档案 + 分支（见 `docs/prompts/new-requirement.md`） |
| **补测试** | 见 `docs/prompts/write-unit-tests.md` |
| **配置/清理/文档**（小改） | 免档案，直接做 |

## 你的第三步：执行（遵守 ESTRIX.md 的任务纪律）

- **用 todoWrite 列清单**，逐项做，做一项勾一项
- **做不了就明说**（不许默默跳过）
- **每步验证**：`typecheck` + `test` + `lint`，全绿再继续
- 改到运行时行为（IPC / hook / 工具 / UI）→ **必须真机 `npm start` 验证**

## 你的第四步：收尾

1. **更新 `docs/backlog.md`**：把完成的条目移到"已完成"或删除
2. **交报告**（见 ESTRIX.md 第三节）：做了什么 / 没做什么 / 验证结果 / 后续建议
3. 提交（commit message 说清做了哪条）

## 特别提醒

- 一次**只做 backlog 里的一条**（或明确相关的一组），不要贪多
- 若一条太大，**拆成子任务**，先做能独立完成的部分
- 若发现新的待办，**追加到 `docs/backlog.md`**
