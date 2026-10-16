# P3a ESM 转换操作手册（交接给执行 AI）

> 目的：把 `src/` 和 `tools/` 的 CommonJS 代码逐个转为 ESM。
> 本手册基于试点（`tools/decodeOutput.js`）确定的规则，**必须严格遵守以保证一致性**。
> 配套决策：`03-decisions.md` D18（全转 ESM）、D19（先 ESM 后 TS）。

---

## 0. 环境事实（已验证）

- Node 26 / Electron 44 支持 `require(ESM)`（模块语法自动检测）。
- `main.js`/`preload.js` 已注册 `tsx/cjs` 钩子。
- **过渡期 CJS 可 require ESM 文件**（已实测），故可逐个文件转。
- **不**在过渡期加 `package.json` 的 `"type": "module"`（最后统一加）。

---

## 1. 转换规则

### 1.1 导出（module.exports → export）

| CJS 写法 | ESM 写法 |
|---|---|
| `module.exports = { a, b }` | `export { a, b };` |
| `module.exports = { a, b, c }`（多行） | `export { a, b, c };` |
| `module.exports = someFn`（单值） | `export { someFn };`（**给匿名值取名，见 1.3**） |
| `module.exports = new Foo()`（单值实例） | 具名后 `export { instance };`（**见 1.3**） |

**禁止** `export default`——实测它被 CJS `require` 时得到 `{ default: x }`，会破坏过渡期兼容。

### 1.2 导入（require → import）

| CJS 写法 | ESM 写法 |
|---|---|
| `const { a } = require('./x')` | `import { a } from './x.js';` |
| `const a = require('./x')`（命名空间） | `import * as a from './x.js';` |
| `const a = require('fs')`（内置） | `import * as fs from 'node:fs';`（或 `import fs from 'node:fs'`） |
| `const path = require('path')` | `import path from 'node:path';` |
| `const { app } = require('electron')` | ⚠️ **特殊**：用 createRequire（见 1.5），**不可** `import` |

**关键**：
- **相对路径必须加 `.js` 扩展名**（如 `'./x.js'`）——即使源文件将来是 `.ts`，也写 `.js`（TS 约定）。
- **内置模块加 `node:` 前缀**（`node:fs` / `node:path`）。
- **第三方模块（electron/mysql2/turndown 等）不加**扩展名、不加前缀。

### 1.3 单值导出（3 处，特殊处理）

```js
// 原：module.exports = bindEvents;         （src/preload/overlay/events.js）
// 转：export { bindEvents };
//     ⚠️ 必须同步改引用方：const bindEvents = require('./events')
//        → import { bindEvents } from './events.js';

// 原：module.exports = new BrowserWindowManager();   （tools/browser-window-manager.js）
// 转：const windowManager = new BrowserWindowManager();
//     export { windowManager };
//     ⚠️ 同步改引用方
```

### 1.4 动态 require（3 处，特殊处理）

```js
// src/providers/custom/loader.js、src/providers/index.js
// 无法静态转 import，改用 createRequire：

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// 之后的 require(filePath) 保持原样
```

### 1.5 electron 模块（特殊：必须用 createRequire）

**规则**：`require('electron')` 转 ESM 时，**不用 `import`**，改用 `createRequire`：

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { app, BrowserWindow } = require('electron');
```

**原因**（已实测）：
1. `node_modules/electron/index.js` 是 `module.exports = getElectronPath()` —— 导出**字符串**
   （可执行文件路径），不是对象。
2. 测试的 mock（`test/helpers/mock-electron.js`）通过猴子补丁 `Module._load` 注入假 electron，
   **只对 `require()` 生效，对 `import` 无效**。
3. `import { BrowserWindow } from 'electron'` 会让 Node 对真 electron 做静态分析，
   发现无 `BrowserWindow` 具名导出 → **链接期抛错**。

**createRequire 方案同时满足两个环境**（已验证）：
- 测试环境：`require('electron')` 走 `Module._load` → mock 生效 ✅
- 真实 Electron：拿到真对象 ✅

**影响**：全仓 16 处 `require('electron')` 都按此规则。

---

### 1.6 __dirname / __filename（6 处）

```js
// 顶部加：
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 或直接用 import.meta.dirname（Node 20.11+，已验证可用）
```

---

## 2. 每个文件的操作流程

1. `read` 整个文件
2. 按第 1 节规则转换 import / export / __dirname / 动态 require
3. `write` 回去
4. **若改了导出形态**（单值导出），检查并同步修改所有引用方
5. 验证：
   - `npm run typecheck` → 通过
   - `npm run lint` → 0 errors
   - `node --test test/tools/*.test.js test/main/*.test.js test/preload/*.test.js` → 全绿
6. `git commit -m "refactor(P3a): <文件> 转 ESM"`

**一个文件一个 commit**，便于回滚。

---

## 3. 转换顺序（叶子 → 根，减少连锁）

1. `tools/`（decodeOutput 已完成，其余按依赖顺序）
2. `src/utils/`
3. `src/infra/`（无）
4. `src/providers/`
5. `src/main/`
6. `src/preload/`
7. `test/`（最后）

---

## 3.5 关键教训（P3a 实际踩坑记录）

### 教训 1：electron 必须用 createRequire（已写入 1.5）

### 教训 2：测试打桩 Module._load 对 ESM import 无效

旧测试用 `Module._load = fn` 猴子补丁打桩（只对 `require` 生效）。源文件真转 ESM 后，
`import` 绕过它 → 加载真实模块 → 测试崩（如 `document is not defined`）。

**解法**：改用 vitest 的 `vi.mock`（能拦截 ESM）。样板见：
- `test/preload/tool-loop-watchdog.test.js`
- `test/preload/retry-engine.test.js`
- `test/preload/intercept-observer.test.js`

**要点**：
- mock 工厂要 hoisted，可观测对象用 `vi.hoisted(() => ({...}))`
- 每个测试用 `vi.resetModules()` + 动态 `import()` 重新求值（取代 `require.cache` 清除）
- **electron 例外**：源码用 createRequire 加载 electron，vi.mock 拦不到 → 仍需 Module._load 打桩
  （样板见 `test/main/updater.test.js`：electron 用 Module._load，其余包用 vi.mock）

### 教训 3：Electron preload 不能用顶层 await（TLA）

`preload.js` 最初用 `await import('tsx/esm/api')` + `await import('./src/preload')` 注册钩子。
但 **Electron 用 `require()` 加载 preload**，而 `require(ESM)` 不支持带 TLA 的模块 →
`ERR_REQUIRE_ASYNC_MODULE` → preload 加载失败 → **UI 全无**。

**解法**：preload.js 去掉 TLA，改纯静态 import。当前 preload 图全是 .js，无需 tsx 钩子。
（主进程 main.js 有 TLA 合法——它走 ESM import，不走 require。）

**对 P3b 的影响**：preload 转 TS 时，**不能靠 TLA 注册 tsx**。需改用
Electron 的 ESM preload（`.mjs`）或预编译方案。

### 教训 4：ESM 循环依赖用静态 import + 活绑定

`chat-input ↔ tool-loop-watchdog` 循环，原用懒 require 打破。ESM 下直接静态 import 即可
（活绑定 + 运行时取值）。已实测通过。

---

## 4. 暂停点

每个文件转换后必须三项全绿才能继续。**任何一项红 → 立即回滚该文件**（`git checkout <file>`），报告问题，不要带病前进。

---

## 5. 已完成

- ✅ `tools/decodeOutput.js`（试点，a31997f）
- ✅ `eslint.config.js` 的 `sourceType` 改为 `module`
- ✅ `tools/` 全部 22 个文件转 ESM（含 browser-window-manager 方案 D）
- ✅ `src/utils/`、`src/providers/`、`src/main/`、`src/preload/` 全部转 ESM
- ✅ 测试基建从 `node --test` 迁移到 **Vitest**（新增 vitest.config.mjs；280 测试全绿）
- ✅ 根入口 `main.js`/`preload.js`/`start.js`/`eslint.config.js`/`test/*.js` 转 ESM
- ✅ `package.json` 加 `"type": "module"`
- ✅ Electron 应用 ESM 启动实测通过（18 工具注册、preload 正常）
- ✅ 「假 ESM」清理：7 个自家模块真转 ESM（含 4 个测试改 vi.mock）
- ✅ preload.js 去 TLA 修复（c117ecd）
- ✅ 真机重启验证通过（UI/功能正常）

---

## 6. 待办清单

（执行 AI 在此勾选）

- [x] tools/ 全部文件（22 个）
- [x] src/utils/with-log.js
- [x] src/providers/（6 个）
- [x] src/main/（11 个）
- [x] src/preload/（17 个）
- [x] test/（迁移到 Vitest）
- [x] 最后统一：package.json 加 "type": "module" + main.js/preload.js 改 import
