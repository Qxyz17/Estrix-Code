# 本项目约束（Estrix Code 自身）

> 本文件在初始化项目时随系统提示词发送给 AI。**做任何改动前请遵守以下约束。**

## 一、开工前：先读文档

1. 读 `docs/architecture.md`（及 `docs/arch/` 分册），尤其：
   - `01-structure.md` 文件职责 ／ `02-dependency.md` 依赖铁律 ／ `03-build.md` 构建与生成物
   - `05-tasks.md` 常见任务手册 ／ `06-testing.md` 测试哲学
2. **若本次任务有对应的任务提示词**（`docs/prompts/*.md`），**完整读它，并按其中的清单逐项执行**。
3. 读 `docs/requirements/INDEX.md` 了解已有需求。

## 二、任务纪律（硬要求）★

- **逐项完成**：任务或提示词里列了清单（如 P0/P1/P2、步骤 1~7），**每一项都要做，不许跳**。
- **用 todoWrite 跟踪**：多步任务先列 todo，做一项勾一项，随时知道还剩什么。
- **做不了就明说**：某项确实无法完成（缺依赖 / 需人工 / 不确定），**立即说明原因**，不许默默跳过。
- **边做边验**：每完成一项，立即 `typecheck` + `test` + `lint`，全绿再继续。
- **不带病前进**：有报错先修好，不要攒到最后。

## 三、收尾：必须交付报告（硬要求）★

任何任务结束（无论大小），必须用一段话说明：

1. **做了什么** —— 改了哪些文件、加了哪些测试/功能
2. **没做什么** —— 漏项、跳过项，**及原因**
3. **验证结果** —— `typecheck` / `test` / `lint` 是否全绿；是否需真机验证
4. **后续建议** —— 遗留项、风险、待办

**不许"默默少做"**。少做了、跳过了，必须写明——这是硬性要求。

## 四、依赖方向（铁律）

```
infra ← providers ← tools ← bridge ← session ← app
                    ↑          ↑
                 overlay ──────┘
```

- overlay **不依赖** bridge / session（用回调注入）
- bridge / session **不依赖** overlay 的 state（数据经回调推送）
- 详见 `docs/arch/02-dependency.md`

## 五、需求流程

- **新功能 / 行为变更 / 多文件改动 / 需决策** → 建需求档案 + 分支
  - 档案：`docs/requirements/<id>-<slug>.md`
  - 分支：`<type>/<id>-<slug>`（如 `feat/003-dark-mode`）
  - 流程提示词：`docs/prompts/new-requirement.md`
- **小改动**（单文件单行 / 纯文案 / 依赖升级）→ 免档案，直接改
- 需求文档格式与 INDEX 机制见 `docs/requirements/README.md`

## 六、测试哲学（血泪教训）

- **只写"真实集成测试"，不写"深 mock 测试"**
- 不 mock 内部模块、不断言"mock 被调用"；模拟 `window`/`document`/`localStorage` 等**外部边界**是允许的
- **优先覆盖失败路径**（参数非法 / 文件不存在 / 网络失败 / 边界值）
- 补测试提示词：`docs/prompts/write-unit-tests.md`

## 七、改工具只改一处（D12）

工具是**唯一真相源**。改 `src/tools/impl/*.ts` 的 `apiMetas` + `bootstrap()`，
API 契约（`api.d.ts`）与沙箱注入（`bootstrap.generated.ts`）**自动生成**。
- 名字四处一致：`apiMetas.name` = `super()` 首参 = `bootstrap` 里 `__call` 首参 = `globalThis.xxx`
- **别手改生成物**：`*.generated.ts`、`src/tools/api.d.ts`

## 八、提交前必做

```bash
npm run typecheck   # 两套 tsconfig，0 错误
npm test            # 全绿
npm run lint        # 0 problems
npm run compile     # 构建通过
```

**改了运行时行为（IPC / hook / 工具 / UI）→ 必须真机 `npm start` 验证。**

## 九、其他

- 窗口结构：地址栏在 `win.webContents`（壳页面），AI 页面在 `ctx.view`（WebContentsView）。
  操作 AI 页面用 `ctx.view.webContents`，**不是** `ctx.win.webContents`
- 修改需求文档后 INDEX 自动更新（pre-commit 钩子）；也可手动 `npm run docs:index`
- 有疑问先问，别猜
