# docs/requirements —— 需求档案

> 每个需求一个文件，记录**背景 → 目标 → 方案 → 验收 → 遗留**，并与 git 分支关联。

## 规则

### 文件命名
```
docs/requirements/<三位序号>-<短横线英文slug>.md
```
例：`001-address-bar.md`、`002-interrupt-retry.md`

### 文档结构（固定）
文件头部是 YAML frontmatter（结构化数据，供脚本与 AI 解析）：

```yaml
---
id: 001
type: feature          # feature | fix | refactor | chore | docs
title: 窗口地址栏
status: done           # draft | doing | review | done | dropped
branch: feat/address-bar
created: 2026-09-20
updated: 2026-09-21
---
```

正文固定五节：`背景` / `目标` / `方案` / `验收标准` / `遗留`。

### 分支关联
- 分支名**必须含需求 ID**：`<type>/<id>-<slug>`
  - 例：`feat/001-address-bar`、`fix/002-interrupt-retry`
- 需求文档的 `branch` 字段记录对应分支名

→ 从需求找分支、从分支反查需求。

### INDEX.md
`INDEX.md` 是**自动生成**的总览表，**不要手改**。

**自动更新**（两道保障）：
- **pre-commit 钩子**：提交时若 `docs/requirements/` 有改动，自动重生成并加入本次提交
- **CI 校验**：若 INDEX 与文档不一致，CI 会失败（见 `.github/workflows/quality.yml`）

手动执行（通常不需要）：
```bash
npm run docs:index
```

> 钩子随仓库分发，`npm install` 时经 `prepare` 脚本自动挂载（`git config core.hooksPath .githooks`）。
> 换机器后若钩子没生效，手动跑一次 `npm install` 或 `npm run prepare`。

## 何时建档案

**必须建**：新功能 / 新工具 / 新平台、行为变更、涉及多文件的改动、需要决策的改动。

**可跳过**：单文件单行修复、纯文案 / 注释 / 格式、纯依赖升级。

**拿不准就建。**（跳过时仍建议建分支，commit message 说清即可。）

---

## 状态流转

```
draft（刚建）→ doing（实现中）→ review（待验收）→ done（完成）
                                       ↘ dropped（放弃）
```

## 与其他文档的分工

| 文档 | 角色 |
|---|---|
| `docs/architecture.md` | 系统**怎么工作**（静态架构） |
| `docs/requirements/` | **每个需求**的过程档案（动态） |
| `Roadmap.md` | 未来**计划**（还没立项的） |
| `CHANGELOG.md` | **发布**记录（面向用户） |

## AI 工作流

新需求时，见提示词 `docs/prompts/new-requirement.md`。
