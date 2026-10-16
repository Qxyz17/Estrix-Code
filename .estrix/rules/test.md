---
name: test
paths:
  - "test/**/*.js"
  - "test/**/*.ts"
---

# 测试规则（血泪教训）

- **只写"真实集成测试"**，不写"深 mock 测试"
- ❌ 不 mock 内部模块、不断言"mock 被调用"
- ✅ 模拟 `window`/`document`/`localStorage` 等**外部边界**是允许的
- **优先覆盖失败路径**（参数非法 / 文件不存在 / 网络失败 / 边界值）
- 用 `ESTRIX_HOME` 环境变量隔离用户目录，**别污染真实 `~/.estrix`**
