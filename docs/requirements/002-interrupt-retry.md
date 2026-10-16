---
id: 002
type: fix
title: AI 回复中断的检测与自动重试
status: done
branch: —
created: 2026-09-20
updated: 2026-09-21
---

## 背景

两个相关的问题：

1. **AI 回复被服务端截断**（网页显示"已停止"，正文没生成完）时，系统把它当作"用户主动停止"而**静默忽略**，不重试，任务无声中断。
2. 修复过程中又出现**误判**：对话正常完成也被判定为中断，导致无谓重试。
3. **服务端限流（"操作过于频繁"）被误判为普通失败**：DeepSeek 在限流时返回
   HTTP 200 + JSON body（非 SSE），其中 `data.biz_code = 40029`（IP_ACCESS_RESTRICTED）。
   旧 hook 只按 SSE 解析该 body，收不到任何帧，最终归为普通 error，
   **走了"普通失败"的退避策略（4~10 秒 / 10 次）**，而不是应有的
   "操作频繁"策略（60 秒 / 20 次），导致重试过快、次数过少。

## 目标

准确区分终态**与失败类型**，只有"真正的失败/截断"才触发自动重试，且退避策略与失败类型匹配：

| 情况 | 期望 |
|---|---|
| 正常完成（finished，有正文） | 不重试 |
| 用户主动停止（点停止按钮） | 不重试（忽略） |
| 服务端截断（INCOMPLETE / 正文为空） | **重试**（普通失败策略） |
| 操作频繁（HTTP 429 或 biz_code=40029） | **重试**（操作频繁策略：60 秒 / 20 次） |

## 方案

### 一、终态判定（已完成）

在 `src/providers/hooks/deepseek.ts` 的 `resolveStatus` 中：

1. `finished` **优先**（即使同时有 INCOMPLETE 也算完成）——修正"正常完成还重试"
2. 新增判定：`finished` 但**正文为空、只有思考内容** → 归 error（"思考被中断、正文未生成"）
3. 仅 `userStopped`（拦截到 `stop_stream` 请求）才算 `stopped`
4. 其余（非 finished 且非 userStopped）→ 归 error，触发重试

hook 把 error 状态通过 `estrix-ai-error` 事件发出，`src/bridge/loop/retry.ts` 订阅后按退避重发提示词。

### 二、失败类型区分（本次补充）

**hook 侧**（`deepseek.ts` fetch 拦截）：

- HTTP 非 2xx 且 `status === 429` → `reason: 'rate_limit'`
- HTTP 200 但 `content-type` 非 `text/event-stream`（非流式 JSON）→ 解析两级错误码：
  - **顶层 `code`=40029** → "请求过于频繁"（HTTP 层全局鉴权拦截）→ `reason: 'rate_limit'`
  - **`data.biz_code`=40029** → "操作过于频繁"（completion 非流式错误）→ `reason: 'rate_limit'`
  - 其它非 0 码 → `reason: 'biz'`（普通失败）

  > DeepSeek 响应信封：`{ code, msg, data: { biz_code, biz_msg, biz_data } }`
  > 两个 toast（`ipAccessRestrictedToast` / `operationTooFastToast`）本质都是 40029，只是出现在不同层级。
- 否则照旧按 SSE 解析

**重试引擎侧**（`retry.ts`）：

- 判定条件由 `httpStatus === 429` 放宽为
  `httpStatus === 429 || reason === 'rate_limit'`
- 命中即走"操作频繁"配置（`estrix-retry-429-delay` / `estrix-retry-429-count`，
  UI 标签为"操作频繁后重试间隔/次数"）

> localStorage 键名保留 `estrix-retry-429-*` 不变（改名需迁移用户配置，不值当），仅显示文案对齐。

## 验收标准

- [x] 正常完成不重试
- [x] 用户主动停止不重试
- [x] 服务端截断（正文为空）自动重试
- [x] 真机验证通过（终态判定）
- [ ] 操作频繁（HTTP 429）走"操作频繁"策略
- [ ] 操作频繁（顶层 code=40029，请求过于频繁）走"操作频繁"策略
- [ ] 操作频繁（data.biz_code=40029，操作过于频繁）走"操作频繁"策略

## 遗留 / 后续

- 诊断代码（`dbg` / `snapshot` / 诊断 log）暂留，后续可清理
- `resolveStatus` 的中断判定目前只在 deepseek hook；claude / chatgpt 无对应逻辑
- hook 侧的非流式 JSON 判定为通用规则；若未来出现其它限流码，需在 `deepseek.ts` 补充
