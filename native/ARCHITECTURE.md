# Estrix Code — Tauri (Rust) 版架构设计

> 状态：设计稿 v0.1
> 目标：用 Rust 重写工具执行层，替换 Electron 版的 vm JS 沙箱
> 作者：AI 辅助设计（基于对 Electron 版 v0.3.1 的逆向梳理）

---

## 1. 背景与动机

### 1.1 Electron 版现状

当前 Electron 版（v0.3.1-alpha）能跑，但存在结构性问题：

| 问题 | 说明 |
|------|------|
| JS 沙箱脆弱 | 用 vm.createContext + codeGeneration:{strings:false} 隔离 AI 代码，仍存在原型链逃逸风险，需持续打补丁 |
| 沙箱能力残缺 | 实测踩到：setTimeout is not defined（沙箱不注入定时器）、单次执行 60s 硬超时 |
| 双运行时 | Electron 自带 Node.js + Chromium，再叠加 JS 沙箱，内存与体积双重浪费 |
| 工具契约是 JS 函数 | AI 必须写 JS 调 read()/write()，错误率高，难以静态校验 |

### 1.2 为什么用 Rust + 终端

- 内存：Tauri 空载约 249MB（含 WebView2），Electron 约 350-500MB+；安装包 8MB vs 100MB+
- 安全：执行层不做"任意代码执行"。AI 生成的 shell 命令经用户确认后运行，行为可读可审
- 简单：执行层只有 shell 原语 + 3 个文件工具，没有沙箱、没有 JS 引擎、没有协议解析
- 能力完整：shell 是万能接口，不存在"工具覆盖不到"的角落；Rust 原生异步/超时/并发

---

## 2. 总体架构

Tauri 应用（Rust 主进程）包含：Window Manager（多窗口/标签）、Shell 执行器、3 个原生文件工具，通过 Tauri IPC 与 WebView 通信。

每个窗口加载一个 AI 平台页面（chat.deepseek.com / claude.ai 等），并注入 JS 覆盖层：
- Observer 监测回复
- tool-parser 解析工具调用
- 覆盖层 UI 渲染执行结果

### 2.1 与 Electron 版的对应关系

| Electron 层 | Tauri 对应 | 复用程度 |
|-------------|-----------|---------|
| main/index.js 窗口管理 | WindowManager (Rust) | 重写 |
| main/ipc.js | commands.rs (Tauri command) | 重写 |
| tools/*.js 23 个工具 | shell 原语 + 3 原生工具 | 大幅精简 |
| tools/JsRunner.js | 删除（无 JS 沙箱） | 不再需要 |
| preload/dom/* 注入 | initialization_script | 尽量复用（JS） |
| src/prompt/*.md | 同 | 复用 |
| providers/* | providers.rs | 重写（轻量） |

---

## 3. 执行模型：终端优先，零 JS

### 3.1 核心原则

**AI 的每一个操作，都表达为一条 shell 命令。**

Rust 侧不执行任何 JavaScript，不解析 JSON 工具调用，不维护代码沙箱。整个执行层只有：

1. **一个原语**：执行 shell 命令（bash / pwsh）
2. **少量原生工具**：文件读 / 写 / 编辑（shell 做不优雅或做不了的）
3. **终端**：AI 需要的一切能力，最终都通过终端命令完成

### 3.2 为什么

| 维度 | 说明 |
|------|------|
| **简单** | 没有 JS 引擎、没有沙箱、没有协议解析。执行层就是 `Command::new(...)` |
| **安全** | 不存在"AI 写的代码在本地执行"这一层。命令由用户确认后执行，行为可读可审 |
| **能力完整** | shell 是万能接口：文件、进程、网络、注册表、包管理……没有任何"工具覆盖不到"的角落 |
| **AI 友好** | 模型对 shell 命令的生成质量远高于自创 DSL；无需教 AI 新协议 |
| **Rust 友好** | `tokio::process` + `timeout` + `kill`，原生异步，不受沙箱限制 |

### 3.3 AI 的输出形态：专属标记 estrix:bash / estrix:pwsh

**核心问题**：AI 在回答里经常输出 shell 命令作为**示例/讲解**（比如"你可以运行 npm install"），而不是真的要执行。如果直接匹配普通的 bash 代码块，会**误触执行**。

**解决**：只有带专属前缀 **estrix:bash** / **estrix:pwsh** 的代码块才被视为**执行请求**；普通 bash / pwsh 代码块只是讲解，永不执行。

要执行命令时，AI 输出（用三反引号围栏，语言标记为 estrix:bash）：

    [围栏开始] estrix:bash
    ls -la src/
    [围栏结束]

或（语言标记为 estrix:pwsh）：

    [围栏开始] estrix:pwsh
    Get-ChildItem src | Select-Object Name,Length
    [围栏结束]

仅作讲解时，AI 输出普通围栏（**不执行**）：

    [围栏开始] bash
    npm install
    [围栏结束]

**规则**：
- estrix:bash → 用 bash/cmd 执行
- estrix:pwsh → 用 PowerShell 执行
- 其余任何语言标记的代码块（含普通 bash / pwsh）→ 纯展示，不执行

这样 AI 可以自由地讲解命令，而执行只发生在它**明确标注** estrix:bash / estrix:pwsh 时。

### 3.4 原生工具的定位

只有 3 个操作不适合用 shell 表达，保留为原生工具（因为 shell 做不优雅）：

| 原生工具 | 为什么不能用 shell | 说明 |
|---------|------------------|------|
| read | shell 无"带行号 + 分页 + 字节上限"的优雅实现 | 返回带行号窗口，支持 offset/limit，对齐现有 ReadTool 输出格式 |
| write | 多行内容经 shell 引号转义易错 | 直接写文件，避免转义地狱 |
| edit | shell 无"精确字符串替换 + dryRun + 替换处数"语义 | 精确替换，支持 replaceAll / dryRun |

**其余全部走 shell**：glob 用 dir/find/Get-ChildItem，grep 用 findstr/Select-String/rg，删除用 del/rm，建目录用 mkdir，网络用 curl/Invoke-WebRequest，MySQL 用 mysql CLI……

**原生工具怎么触发**？同样用专属标记，例如围栏写 estrix:read，内容为文件路径。原则：**所有执行请求都必须有 estrix: 前缀**，杜绝误触。

### 3.5 执行流程

    AI 生成回复
          │
          ▼
    覆盖层扫描代码块，只挑出围栏为 estrix:bash / estrix:pwsh / estrix:read ... 的块
          │
          ▼
    普通 bash / pwsh / 其他代码块 → 忽略（仅展示）
          │
          ▼
    用户确认（危险命令高亮警告）
          │
          ▼
    Tauri invoke → Rust 执行
          │
          ▼
    捕获 stdout/stderr + exit code
          │
          ▼
    回传覆盖层 → 发送给 AI

### 3.6 原生工具与命令的统一回传格式

无论走原生工具还是 shell，回传给 AI 的都是**纯文本**（便于 AI 理解）：

- 成功：输出内容（截断超长部分）
- 失败：[exit code: N] 标记 + stderr
- 超时：[timed out after Nms] 标记

与 Electron 版现有格式保持一致。

---

## 4. Rust 执行层设计

### 4.1 Crate 结构

    native/
    ├── src-tauri/
    │   ├── Cargo.toml
    │   └── src/
    │       ├── main.rs           # 入口
    │       ├── lib.rs            # Tauri Builder 组装
    │       ├── commands/         # Tauri command（IPC 入口）
    │       │   ├── mod.rs
    │       │   ├── shell.rs      # execute_command（核心原语）
    │       │   ├── native.rs     # read / write / edit
    │       │   ├── project.rs    # init_project / project_dir
    │       │   └── window.rs     # 窗口/标签管理
    │       ├── shell/            # shell 执行原语
    │       │   ├── mod.rs
    │       │   ├── exec.rs       # tokio::process 封装、超时、kill
    │       │   └── decode.rs     # 输出编码检测（GBK/UTF-8）
    │       ├── native/           # 原生文件工具
    │       │   ├── read.rs       # 带行号窗口
    │       │   ├── write.rs
    │       │   └── edit.rs
    │       ├── providers/        # AI 平台适配
    │       └── prompt/           # 系统提示词组装
    ├── ui/                       # 前端（注入层 + 覆盖层，JS，仅做 DOM）
    └── ...

**关键**：没有 `tools/` 目录下的一堆工具实现，没有 JS 沙箱，没有协议解析器。执行层就是 shell + 3 个文件工具。

### 4.2 核心原语：execute_command

```rust
pub struct CommandRequest {
    pub command: String,
    pub workdir: Option<PathBuf>,
    pub timeout_ms: Option<u64>,
    pub detached: bool,   // 对应 cmd /c start /b
}

pub struct CommandResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub timed_out: bool,
}

pub async fn execute_command(req: CommandRequest, project_dir: Option<&Path>) -> CommandResult {
    let cwd = resolve_dir(req.workdir.as_deref(), project_dir);
    let shell = detect_shell(); // cmd / powershell / bash

    let mut cmd = if req.detached {
        // 脱离父进程：长任务不被超时杀掉
        build_detached(&shell, &req.command)
    } else {
        build_attached(&shell, &req.command)
    };

    cmd.current_dir(cwd)
       .stdout(Stdio::piped())
       .stderr(Stdio::piped());

    match req.timeout_ms {
        Some(ms) => tokio::time::timeout(Duration::from_millis(ms), run(cmd)).await ...,
        None => run(cmd).await,  // 不传超时 = 不限时
    }
}
```

### 4.3 原生文件工具

只有 3 个，全部用 `tokio::fs`：

| 工具 | 要点 |
|------|------|
| `read` | 流式读；窗口算法**完全对齐**现有 ReadTool 的 buildWindow（offset 默认 1，limit 默认 2000，maxLineLength=2000，maxBytes=50KB，行号格式 `N: text`，footer 提示） |
| `write` | 直接写文件，避免 shell 引号转义；支持覆盖/创建 |
| `edit` | 精确字符串替换；支持 `replace_all`、`dry_run`；返回替换处数 |

**为什么只保留这 3 个**：多行文本、精确匹配、行号窗口——这三件事 shell 表达起来要么转义地狱，要么做不到。

### 4.4 超时与取消（解决 Electron 版的痛点）

| 类别 | 超时策略 |
|------|---------|
| shell 命令 | **默认不限时**，由 AI 传 `timeoutMs` 控制；或 `detached: true` 后台运行 |
| read / write / edit | 30s（本地文件操作，够用） |

**取消**：前端点"取消" → Rust 侧 `CancellationToken::cancel()` → 正在跑的子进程被 `kill`。

对比 Electron 版：JS 沙箱全局 60s 硬超时，长任务会被杀（实测踩到，只能靠 `start /b` 绕过）。Rust 版把超时控制权交给命令本身。

### 4.5 输出编码处理

Windows 下 shell 输出可能是 GBK（cmd）或 UTF-8（pwsh），需检测并统一转为 UTF-8，对齐现有 `decodeOutput` 行为。

---

## 5. 注入层（复用 JS）

注入层是跑在 WebView 里的 JS，与"工具执行层用 Rust"不冲突——它的职责是 DOM 操作（监测 AI 回复、解析代码块、渲染覆盖层），JS 是这个领域的最佳工具。

### 5.1 Tauri 的注入方式

    tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::External(url))
        .initialization_script(include_str!("../ui/inject.js"))
        .on_navigation(|url| { /* ... */ })
        .build()?;

### 5.2 复用现有 preload/dom 逻辑

src/preload/dom/*.js 的核心（observer、tool-parser、detector）可几乎原样复用，只需把通信层从 Electron 的 ipcRenderer.invoke 换成 Tauri 的 invoke：

    // 旧（Electron）
    const result = await window.estrix.executeTool(name, params);

    // 新（Tauri）
    import { invoke } from '@tauri-apps/api/core';
    const result = await invoke('execute_tool', { toolName: name, params });

### 5.3 平台页面的 iframe 限制

注意：如果 AI 平台页面通过 WebviewUrl::External 加载，Tauri 的 initialization_script 会注入到主框架，但无法注入 iframe（跨域）。需确认 DeepSeek/Claude 的关键 DOM 是否在主框架。Electron 版用的是 BrowserView（等价于独立 webview），注入行为一致，所以应无差异。

---

## 6. 窗口与多账号

Tauri 2 支持多 WebviewWindow，每个窗口独立 WebviewUrl 与 data_directory（profile 隔离）：

    let window = tauri::WebviewWindowBuilder::new(app, &profile_id, url)
        .data_directory(profile_dir)  // 独立 cookie/storage
        .build()?;

对应 Electron 版的 profile-manager.js + window.js。

---
## 7. 系统提示词组装

系统提示词必须让 AI 明白：**执行操作要用专属标记**，而不是普通代码块。

### 7.1 提示词结构

    [项目目录树]

    ## 执行环境
    当前 shell：{cmd | powershell | bash}
    工作目录：{project_dir}

    ## 如何执行操作
    你需要执行命令时，必须使用专属标记的代码块：

    estrix:bash  -> 用 bash/cmd 执行
    estrix:pwsh  -> 用 PowerShell 执行

    示例（会执行）：
    [三反引号] estrix:pwsh
    Get-ChildItem src
    [三反引号]

    **重要**：普通的 bash / pwsh 代码块只是展示，不会执行。
    只有 estrix:bash / estrix:pwsh 标记的代码块才会被执行。

    ## 何时不要用命令
    - 只是讲解、举例时，用普通代码块
    - 需要 AI 自己判断：这是"要执行"还是"只是说明"

    ## 原生工具
    以下操作可直接调用（同样用专属标记）：
    - estrix:read  <文件路径>   # 带行号读取，支持分页
    - estrix:write <文件路径>   # 写入文件
    - estrix:edit  <文件路径>   # 精确替换

    ## 回传格式
    命令输出会以纯文本回传，附 [exit code: N] / [timed out after Nms] 标记。

### 7.2 Rust 伪代码

    pub fn build_system_prompt(project_dir: &Path, shell: &str) -> String {
        let mut s = String::new();
        s.push_str(&render_project_tree(project_dir));
        s.push_str("\n\n## 执行环境\n");
        s.push_str(&format!("当前 shell：{}\n", shell));
        s.push_str(&format!("工作目录：{}\n", project_dir.display()));
        s.push_str("\n## 如何执行操作\n");
        s.push_str(EXEC_MARKER_GUIDE); // 上面那段说明
        s
    }

### 7.3 关键约束（提示词必须明确）

1. **只有 estrix: 前缀的块才执行** —— 否则 AI 会用普通代码块，导致误触或漏执行
2. **AI 要区分"建议"和"执行"** —— 讲解用普通块，真执行用 estrix: 块
3. **明确当前 shell** —— 让 AI 知道该用 cmd 语法还是 PowerShell 语法

---

## 8. 迁移路线图

### Phase 0 — 骨架（当前）
- [x] Tauri 2 项目结构
- [x] 窗口创建
- [ ] WebView 加载 AI 平台页面
- [ ] 注入层基础通信

### Phase 1 — 核心原语
- [ ] Rust 实现 execute_command（shell 原语：cmd / powershell / bash）
- [ ] 超时 / 取消 / 编码处理
- [ ] 注入层检测命令块并回传
- [ ] 端到端：AI 生成命令 -> 用户确认 -> Rust 执行 -> 结果回显

### Phase 2 — 原生文件工具
- [ ] read（带行号窗口，对齐现有格式）
- [ ] write
- [ ] edit（replace_all / dry_run / 替换处数）
- [ ] 文件路径解析（相对 projectDir）

### Phase 3 — 高级
- [ ] 多账号 profile 隔离
- [ ] 系统提示词组装（教 AI 用 shell + 3 个原生工具）
- [ ] 危险命令检测 / 确认
- [ ] 覆盖层 UI 完整化

### Phase 4 — 打磨
- [ ] 自动更新
- [ ] 打包发布（nsis/dmg）
- [ ] 性能基准（对比 Electron 版）

---

## 9. 风险与开放问题

| 风险 | 说明 | 缓解 |
|------|------|------|
| shell 跨平台差异 | cmd / powershell / bash 语法不同 | 检测平台选 shell；提示词明确当前 shell |
| 危险命令 | AI 可能生成破坏性命令 | 保留现有危险命令检测 + 用户确认 |
| 编码问题 | Windows 下 GBK/UTF-8 混杂 | 统一解码为 UTF-8（对齐现有 decodeOutput） |
| 长任务 | 可能阻塞 | 支持 detached 模式 + 可取消 |
| WebView2 注入限制 | 跨域 iframe 无法注入 | 验证目标平台 DOM 是否在主框架 |
| 注入层复用成本 | preload/dom/* 与 Electron API 耦合 | 抽象通信层，隔离 invoke 调用 |
| read 格式一致性 | Rust 版与 JS 版输出需一致 | 行为对照测试（同一输入，比对输出） |

---

## 10. 决策建议

推荐路径：

1. 冻结 Electron 版功能，只修关键 bug
2. Tauri 版从 Phase 1 做起，先跑通 execute_command 原语
3. **执行层零 JS**：shell 命令 + 仅 3 个原生文件工具（read/write/edit）
4. 注入层保留 JS（只做 DOM 操作），通信层从 Electron IPC 换成 Tauri invoke
5. 建立行为对照测试，确保 read 等原生工具输出与 JS 版一致

不推荐：
- 在 Tauri 里嵌入 JS 引擎或沙箱（徒增复杂度）
- 发明 JSON/DSL 工具协议（shell 已经够用）
- 一次性实现所有能力（先跑通 shell 原语）

---

## 附录 A：能力对照（Electron 工具 -> 新架构）

| Electron 工具 | 新架构实现 |
|--------------|-----------|
| read | **原生工具** read（带行号窗口） |
| read_lines | **原生工具** read（结构化输出） |
| write / writeFile | **原生工具** write |
| edit / editFile | **原生工具** edit |
| bash | **shell 原语** execute_command（cmd） |
| pwsh | **shell 原语** execute_command（powershell） |
| glob | shell：dir / find / Get-ChildItem |
| grep | shell：findstr / Select-String / rg |
| deleteFile | shell：del / rm |
| mkdir | shell：mkdir / New-Item |
| webFetch | shell：curl / Invoke-WebRequest |
| mysql | shell：mysql CLI |
| todoWrite | 覆盖层 UI 状态（非执行层） |
| mcpCall | 待定（可走 shell 调 MCP 进程，或后续加原生） |

**合计**：执行层从 23 个工具缩减为 **1 个原语 + 3 个原生工具**。

## 附录 B：关键差异对照

| 维度 | Electron 版 | Tauri 版（新架构） |
|------|-------------|-------------------|
| 工具执行 | JS（vm 沙箱） | shell 原语 + Rust 原生文件工具 |
| AI 调用形式 | estrix JS 代码块（工具函数） | shell 命令块（bash/pwsh） |
| 工具数量 | 23 个 JS 工具 | 1 原语 + 3 原生工具 |
| JS 沙箱 | 有（vm.createContext） | **无** |
| 超时 | 全局 60s | 按命令控制 / 可取消 / 可 detached |
| 定时器问题 | 沙箱无 setTimeout | 不存在（无 JS 执行层） |
| 内存（空载） | 约 350-500MB | 约 249MB |
| 安装包 | 100MB+ | 约 8MB |
| 长任务 | 需 start /b 绕过 | 原生 detached |

