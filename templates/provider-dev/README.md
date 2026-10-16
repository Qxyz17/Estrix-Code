# 自定义平台 Provider 开发指南

> 把这个文件夹作为**项目目录**打开，然后让 Estrix 的 AI 帮你写一个 **Provider**——
> 让 Estrix 支持任意 AI 聊天网站（不止内置的 DeepSeek / Claude / ChatGPT）。

---

## 一、这是什么

Estrix Code 靠 **Provider（平台适配器）** 来操作一个 AI 网站：找到输入框、发送消息、识别页面、拿到 AI 回复。

内置了 DeepSeek / Claude / ChatGPT。**本文件夹用来开发你自己的 Provider**——比如支持某个国产大模型、公司内部工具、垂直领域的 AI 网站。

---

## 二、怎么用（用户视角）

1. 把这个文件夹（`provider-dev/`）作为**项目目录**在 Estrix 里打开
2. 对 AI 说：**"帮我写一个 xxx 平台的 Provider"**（附上网站地址）
3. AI 读本文件 → 指导你填选择器 → 产出 `my-platform.js`
4. 在 Estrix「新建窗口 → 平台选择页」点「**导入自定义 Provider**」，选那个 `.js` 文件
5. 以后就能像内置平台一样用它了

---

## 三、AI 必读：Provider 接口

> AI 在写 Provider 前，**必须完整读完本节**。

### 必需字段（缺一个都导入失败）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 唯一标识（英文，无空格），如 `my-platform` |
| `name` | string | 显示名，如 `我的平台` |
| `homeUrl` | string | 首页地址，新窗口默认打开它 |
| `sessionUrlBase` | string | 会话 URL 前缀，如 `https://x.com/chat/` |
| `matchesUrl(url)` | function | 判断 URL 是否属于本平台，返回 boolean |
| `extractSessionId(url)` | function | 从 URL 提取会话 ID，返回 string 或 null |

### 可选字段（推荐实现）

| 字段 | 类型 | 说明 |
|---|---|---|
| `useIntercept` | boolean | 是否用网络拦截拿回复（默认 false = DOM 抓取） |
| `getHookSource()` | function | 启用拦截时**必须实现**，返回自包含源码字符串 |
| `findInput()` | function | 返回可见的输入框元素 |
| `findSendButton()` | function | 返回可见且未禁用的发送按钮 |
| `extractUserInfo()` | function | 返回当前登录用户名（用于窗口标题） |
| `homeUrlPattern` | RegExp | 首页正则（用于"首页模式"） |
| `isElementVisible(el)` | function | 元素是否可见 |

### 完整类型定义

见 `src/providers/types.ts`（本仓库）。

---

## 四、两种模式：DOM 抓取 vs 网络拦截

| | DOM 抓取（默认） | 网络拦截（推荐） |
|---|---|---|
| **原理** | 读页面上渲染出来的回复 DOM | 包装 `fetch`/`XHR`，解析 SSE 流 |
| **优点** | 简单，不用分析网络 | 拿到**完整**文本（含 markdown、思考）、稳定 |
| **缺点** | 可能拿不全（流式/虚拟列表/富文本） | 需要会看 Network 面板 |
| **实现** | 只写 `findInput` 等 | 额外实现 `getHookSource()` |

**建议**：先照 `examples/simple.js` 写 DOM 版跑通；需要更好的效果再上 `examples/intercept.js`。

---

## 五、AI 写 Provider 的步骤

1. **问用户**：目标网站 URL 是什么？首页长什么样？
2. **查 DOM**（关键）：
   - 让用户 `F12` 打开开发者工具
   - 找到**输入框**：Elements 面板选中 → 记下它的标签/class/placeholder
   - 找到**发送按钮**：记下它的标签/aria-label/data-testid
   - 记下**会话 URL 格式**（如 `/chat/abc123`）
3. **写文件**：复制 `provider.template.js` → 填上面的信息
4. **（进阶）网络拦截**：让用户在 Network 面板发一条消息，找到返回回复的请求
   - 看它**响应的格式**（SSE？JSON？）
   - 看 **data: 行**里文本在哪个字段
5. **自检**：过一遍"六、校验清单"

> ⚠️ **不要写死哈希类名**（如 `._9d8da05`）——它们**随平台发版会变**。
> 优先用：语义类名（如 `.ds-think-content`）、`aria-label`、`data-testid`、`placeholder`、`role`。

---

## 六、校验清单（写完必查）

- [ ] `id` / `name` / `homeUrl` / `sessionUrlBase` 都是非空字符串
- [ ] `matchesUrl` / `extractSessionId` 是函数
- [ ] `matchesUrl` 对目标域名返回 true
- [ ] `extractSessionId` 能从会话 URL 正确提取
- [ ] `findInput` 能找到输入框（选择器按优先级排，兜底 `textarea` / `[contenteditable]`）
- [ ] `findSendButton` 能找到按钮（带 `disabled` 判断）
- [ ] 若 `useIntercept: true` → `getHookSource` 有实现，且**自包含**（不 require 外部）
- [ ] 没有写死哈希类名

---

## 七、导入方法

1. Estrix → 新建窗口（或平台选择页）
2. 点「**导入自定义 Provider**」→ 选你的 `.js` 文件
3. 导入后会**复制**到用户目录（源文件删了也不影响）
4. 平台列表里出现你的平台 → 选中即可

**替换**：改完 `.js` 重新导入，会提示"已存在，是否替换"，选替换即可。

---

## 八、调试技巧

| 问题 | 怎么办 |
|---|---|
| 找不到输入框 | F12 检查选择器；确认元素`可见`（不是 `display:none`） |
| 发了没反应 | 检查 `findSendButton` 是否找到按钮；或按回车 |
| 拦截收不到回复 | 确认 `TARGET` 接口路径对不对（Network 面板核对）；确认响应是 SSE |
| 回复不全 | 检查 SSE 解析：`data:` 行、`[DONE]` 标记、增量字段名 |
| 平台发版后失效 | 哈希类名变了 → 改用语义选择器 |

**日志**：Estrix 的窗口有 `wyp/log/` 目录，能看到 `[Estrix Code][hook]` 日志。

---

## 九、参考文件

| 文件 | 用途 |
|---|---|
| `provider.template.js` | 模板（复制它开始写） |
| `examples/simple.js` | 最简 DOM 版示例 |
| `examples/intercept.js` | 网络拦截版示例 |
| `src/providers/types.ts` | 接口类型定义（本仓库） |
| `src/providers/deepseek.ts` | 内置 DeepSeek（复杂参考） |
| `src/providers/hooks/deepseek.ts` | DeepSeek 的网络拦截实现（进阶参考） |

---

## 十、给 AI 的最终提示

写完后，**把完整代码输出给用户**，并附上：
1. 这个 Provider 的 `id`（导入后平台列表显示的名）
2. 需要用户注意的地方（如"发送按钮需要手动改选择器"）
3. 如何测试（打开网站 → 发消息 → 看有没有回复）
