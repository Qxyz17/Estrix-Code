# P3b 迁移手册：JS → TS（交接给执行 AI）

> 目标：把 `src/` 与 `tools/` 的 **.js 全迁 .ts**，加最小类型，**行为不变**。
> 配套决策：D9（渐进迁移）、D15'（预编译）、D16、D20（路径锚点）、D21（测试策略）。
> 试点已完成：`tools/decodeOutput.ts`（2d26393）。

---

## 0. 环境事实（已验证）

- 构建：`npm run compile`（tsc -p tsconfig.build.json）→ 输出 `out/`
- 启动：`node start.js`（先 compile 再 electron .）
- 入口：`package.json main = out/src/main/index.js`（无薄壳）
- 测试：vitest 直接跑 `.ts` 源码（内置转换，**无需编译**）
- tsx 已移除（不再需要）

---

## 1. 每文件迁移流程

1. `read` 整个 .js 文件
2. `write` 同路径 .ts 文件（内容：**去掉 JSDoc 冗余、参数加类型、保留逻辑**）
3. `deleteFile` 原 .js
4. 验证三项全绿：
   - `npm run typecheck`
   - `npx vitest run`
   - `npm run compile`（确认编译成功）
5. `git commit -m "refactor(P3b): <文件> → .ts"`
6. 一个文件一个 commit

---

## 2. 类型标注规则（最小化）

- **参数/返回值**必须标（如 `function f(x: number): string`）
- 对象参数：能推断就推断，复杂用 `type` 定义接口
- **允许 `any`**（渐进迁移，不追求一次到位）
- **不改逻辑**——只加类型
- 删掉多余的 JSDoc 类型注释（`@param {Buffer}` 等，TS 类型已表达）
- 保留描述性 JSDoc（说明"为什么"的注释）

### 具体模式

```ts
// 原：function decodeOutput(buf) { ... }
// 改：function decodeOutput(buf: Buffer | null | undefined): string { ... }

// 原：import { state } from './state.js';
// 保持 .js 后缀不变！TS 约定，编译后正好是 .js

// electron（用 createRequire）：
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { app } = require('electron');
// 这段保持原样，不要改

// 动态 require（providers/index.js 等）：
const mod = require('./' + name + '.js');
// 保持原样
```

---

## 3. 顺序（按依赖拓扑，被依赖的先迁）

不是"按目录"，而是"被依赖的先迁"。迁移某文件前，先确认它 import 的 .js 依赖是否已迁。
若未迁且 TS 报签名错误 → 先迁那个依赖。

遇到签名不匹配时，**修定义侧，不修调用侧，不用断言绕过**。

参考顺序（大致叶子 → 根，减少连锁）：
```
1. src/infra/
2. src/utils/
3. tools/（先简单工具，JsRunner 最后）
4. src/providers/
5. src/preload/dom/（叶子：state/js-detector/tool-parser/tool-names）
6. src/preload/overlay/
7. src/preload/（其余）
8. src/main/（最后，最复杂）
```

---

## 4. 关键注意

### 4.0 被运行时重赋值的函数

被运行时重赋值的函数（如类 AOP 的 `withLog` 包装），必须用
`let foo = function() {}` 声明，**不能用** `function foo() {}` ——
TS 不允许给函数声明重赋值（`TS2630: Cannot assign to 'foo' because it is a function`）。
保留具名函数表达式（`let foo = function foo() {}`）便于调试。

### 4.1 import 后缀保持 `.js`
即使源文件是 `.ts`，import 也写 `'./x.js'`（TS 约定，编译后正确）。
**P3a 已让全仓 import 用 .js，所以不用改。**

### 4.2 electron / 动态 require 保持 createRequire
不要试图改成 import（P3a 教训 1）。

### 4.3 测试文件暂不迁
`test/**/*.test.js` 保持 `.js`（D21：测试策略另行处理）。
它们 import 的 `../../src/x.js` 会由 vitest 解析到 `.ts` 源——**已验证可行**（试点）。

### 4.4 编译配置的 include
`tsconfig.build.json` 的 include 是 `src/**/*` + `tools/**/*`——同时匹配 .js 和 .ts，
所以**迁移期间混合态可编译**（.js 原样拷贝，.ts 编译）。

### 4.5 遇到循环依赖
ESM 活绑定可处理，静态 import 即可（P3a 已验证）。若报 `Cannot access X before initialization`，
报告暂停。

---

## 5. 暂停点

每个文件三项全绿（typecheck + test + compile）才能提交。
**任何一项红 → `git checkout` 该文件回滚，报告问题。**

---

## 6. 待办清单（执行 AI 勾选）

### src/（36 个）
- [ ] src/infra/paths.js
- [ ] src/utils/with-log.js
- [ ] src/providers/（6 个）
- [ ] src/preload/dom/（12 个）
- [ ] src/preload/overlay/（4 个）
- [ ] src/preload/（api.js / index.js / tool-names.js）
- [ ] src/main/（12 个）
### tools/（21 个）
- [x] tools/decodeOutput.js（试点 ✅）
- [ ] tools/ 其余 20 个

---

## 7. 完成后

- 全仓 .js → .ts
- 跑完整验收：typecheck + vitest + compile + 真机启动
- 报告，进入 P4
