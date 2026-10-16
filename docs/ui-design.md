# UI 设计规范（Estrix 侧边栏 / 壳窗口）

> 本文件定义 Estrix Code **壳窗口 UI**（地址栏、状态条、左侧边栏）的设计规范。
> **新页面照此实现**，保持一致。
>
> ⚠️ **真源是 src/ui/shell/ 目录**（index.html + partials/ + scripts/ + styles/）。
> src/ui/shell.html 是 build-shell.mjs 的**生成物**——改真源、跑 npm run compile，**别手改 shell.html**。

---

## 一、设计哲学

1. **少边框，多留白** —— 优先用**底色 + 阴影**分层，而非粗边框。
2. **主色克制** —— 蓝色只用于：激活态、主按钮、关键数字。其余一律中性灰。
3. **跟随系统深浅色** —— 用 \`prefers-color-scheme\`，不手动切换。
4. **呼吸感** —— 内边距 14~16px、元素间距 14px，宁松勿挤。

---

## 二、颜色（CSS 变量）

所有颜色走 CSS 变量，**浅色/深色两套**（\`:root\` + \`@media (prefers-color-scheme: dark)\`）。

### 浅色（默认）
| 变量 | 值 | 用途 |
|---|---|---|
| \`--ck-bg\` | \`#ffffff\` | 主背景（卡片、面板） |
| \`--ck-bg-sub\` | \`#fbfbfd\` | 次级背景（活动栏、状态条） |
| \`--ck-surface\` | \`#f5f6f8\` | 填充块（输入框、标签、列表项） |
| \`--ck-surface-hover\` | \`#eef0f4\` | 悬停底色 |
| \`--ck-border\` | \`rgba(16,24,40,0.07)\` | 发丝边框（极淡） |
| \`--ck-border-strong\` | \`rgba(16,24,40,0.12)\` | 强边框（次要按钮） |
| \`--ck-primary\` | \`#4d6bfe\` | 主色（DeepSeek 蓝） |
| \`--ck-primary-strong\` | \`#3b5bdb\` | 主色悬停 |
| \`--ck-primary-soft\` | \`rgba(77,107,254,0.08)\` | 主色柔光（激活底色） |
| \`--ck-text\` | \`#16181d\` | 主文字 |
| \`--ck-text-2\` | \`#545a67\` | 次要文字 |
| \`--ck-text-dim\` | \`#8a8f9b\` | 弱化文字（标签、提示） |
| \`--ck-danger\` | \`#e5484d\` | 危险（删除） |
| \`--ck-green\` | \`#30a46c\` | 成功 |

### 深色
| 变量 | 值 |
|---|---|
| \`--ck-bg\` | \`#16181d\` |
| \`--ck-bg-sub\` | \`#191c22\` |
| \`--ck-surface\` | \`rgba(255,255,255,0.045)\` |
| \`--ck-border\` | \`rgba(255,255,255,0.08)\` |
| \`--ck-primary\` | \`#6b83ff\`（深色下稍亮） |
| \`--ck-text\` | \`#e4e6eb\` |

### 阴影
| 变量 | 用途 |
|---|---|
| \`--ck-shadow-sm\` | 卡片（\`0 1px 2px rgba(16,24,40,.04)\`） |
| \`--ck-shadow\` | 悬停/浮起 |
| \`--ck-shadow-lg\` | 弹窗 |

---

## 三、尺寸规范

| 元素 | 尺寸 |
|---|---|
| **地址栏高度** | 46px |
| **状态条高度** | 28px |
| **活动栏宽度** | 48px |
| **侧边栏总宽** | 320px（展开）/ 48px（收起） |
| **图标栏按钮** | 36×36px，圆角 8px |
| **图标** | 18×18px，\`stroke-width: 2\` |
| **面板内边距** | 16px |
| **标签页间距** | 14px |
| **卡片内边距** | 14px，圆角 12px |
| **按钮** | 高 ~38px（padding 10/14），圆角 9px |
| **输入框** | 高 32px，圆角 9px |

### 字号
| 用途 | 字号 |
|---|---|
| 主文字 | 13px |
| 次要文字 | 12.5px |
| 标签（\`.ck-label\`） | 10.5px（大写、字距 .5px） |
| 弱提示 | 11px |
| **大数字**（Token hero） | 36px |
| 等宽数字 | \`"SF Mono", "Consolas", monospace\` |

---

## 四、组件规范

### 卡片 \`.ck-card\`
\`\`\`css
background: var(--ck-bg);
border: 1px solid var(--ck-border);
border-radius: 12px;
padding: 14px;
box-shadow: var(--ck-shadow-sm);
\`\`\`
**要点**：淡边框 + 微阴影，**不用粗边框**。

### 按钮
| 类 | 用途 | 样式 |
|---|---|---|
| \`.ck-btn-primary\` | 主操作 | 蓝底白字，悬停**微上浮** + 蓝光晕 |
| \`.ck-btn-secondary\` | 次操作 | 白底 + 边框，悬停**去边框**（靠底色） |
| \`.ck-btn-text\` | 文字按钮 | 无底，悬停变红（危险） |
| \`.ck-mini-btn\` | 小按钮 | 蓝柔底 + 蓝字，悬停**实心蓝** |

### 列表项 \`.ck-list-item\`
**无边框**，灰底（\`--ck-surface\`）+ 圆角 9px；悬停变蓝柔底。

### 活动栏项 \`.ck-ab-item\`
- 默认：图标 \`opacity: .45\`
- 悬停：\`opacity: .8\` + 灰底
- 激活：**蓝底柔光 + 图标变蓝**（**不加左侧竖条**）

### 开关 \`.ck-switch\`
iOS 风格：38×22px，圆点 16px，激活蓝色。

### 柱状图 \`.ck-bar\`
横向：左日期 + 中横条 + （悬停 tooltip）。横条圆角 6px，默认 \`opacity: .35\`，悬停 \`1\`。

### 表单（设置页等）
- **分组容器**：直接复用 \`.ck-card\`（白底 + 发丝边 + 12px 圆角 + 微阴影）
- **字段** \`.ck-set-field\`：\`flex column\`，label → input 间距 **6px**
- **标签**：12px，\`--ck-text-2\`
- **输入框** \`.ck-set-input\`：min-height 32px，圆角 9px，聚焦蓝光圈
- **多行** \`.ck-set-textarea\`：圆角 9px，可拖拽
- **区间** \`.ck-set-inline\`：两个输入框 + "至"分隔

---

### 滚动条（全局统一）

**不要逐个元素写滚动条样式**——在 base.css 全局定义一次，所有滚动区域（侧栏、文件树、预览区、列表等）自动统一：

（CSS 见 base.css 顶部「全局滚动条」）

**要点**：
- **4px 细条**、**透明轨道**、**圆角 2px**（横竖一致）
- 颜色用变量 `--ck-scroll-thumb` / `--ck-scroll-hover`（**自动跟随深浅色**）
- **禁止**用 `scrollbar-width`（会让 webkit 自定义样式**失效**，回退成系统粗条）

---


---

## 五、图标

- **一律用 SVG 线条图标**（\`fill: none; stroke: currentColor; stroke-width: 2\`）
- **不用 emoji**
- 常用图标：房子（主页）、¥（Token）、窗口、扳手（工具）、时钟（历史）、齿轮（设置）

---

## 六、布局结构

\`\`\`
壳窗口（shell.html）
├── 顶部工具栏（46px）：项目选择器 + 后退/前进/刷新 + 地址栏 + 主页
├── 状态条（28px）：5 个 token 指标
└── 主区域（flex: 1）
    ├── 左侧边栏（320px）
    │   ├── 活动栏（48px）：图标 + 收起
    │   └── 面板：标签页内容
    └── AI 页面（WebContentsView，右侧）
\`\`\`

**侧边栏收起**：宽度 320 → 48px（保留图标栏）；点激活图标收起，收起时点图标展开。

---

## 七、新页面开发清单

做新标签页时：
1. 活动栏加一个 \`.ck-ab-item\`（data-tab 唯一，SVG 图标）
2. 加一个 \`.ck-tab\`（data-panel 匹配）
3. 内容用 \`.ck-card\` / \`.ck-btn\` / \`.ck-list-item\` 等现有类
4. 颜色**只用 CSS 变量**（别硬编码）
5. 深浅色都测（切换系统主题）
6. 改完 \`npm run compile\`

---

## 八、禁止

- ❌ 硬编码颜色（必须用 \`var(--ck-*)\`）
- ❌ 粗边框（用淡边框 + 阴影）
- ❌ emoji 当图标
- ❌ 手动切换深浅色（跟随系统）
- ❌ 逐个元素写滚动条样式（统一在 base.css 全局定义）
- ❌ 用 `scrollbar-width`（会让 `::-webkit-scrollbar` 失效）
- ❌ 过小间距（\`gap\` ≥ 8px，面板 \`gap\` 14px）
