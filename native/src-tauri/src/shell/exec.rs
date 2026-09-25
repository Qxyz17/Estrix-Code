//! Shell 执行原语实现

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use tokio::io::AsyncReadExt;
use tokio::process::Command;

use super::decode::decode_output;

/// Shell 类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ShellKind {
    Cmd,
    Pwsh,
    Bash,
}

impl Default for ShellKind {
    fn default() -> Self {
        #[cfg(target_os = "windows")]
        {
            ShellKind::Cmd
        }
        #[cfg(not(target_os = "windows"))]
        {
            ShellKind::Bash
        }
    }
}

/// 命令执行请求
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CommandRequest {
    pub command: String,
    #[serde(default)]
    pub workdir: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub detached: bool,
    #[serde(default)]
    pub shell: Option<ShellKind>,
}

/// 命令执行结果
#[derive(Debug, Clone, serde::Serialize)]
pub struct CommandResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub timed_out: bool,
    pub output: String,
}

/// 解析工作目录
fn resolve_dir(workdir: Option<&str>, project_dir: Option<&Path>) -> PathBuf {
    match workdir {
        Some(w) if !w.trim().is_empty() => {
            let p = PathBuf::from(w);
            if p.is_absolute() {
                p
            } else if let Some(pd) = project_dir {
                pd.join(p)
            } else {
                p
            }
        }
        _ => project_dir
            .map(|p| p.to_path_buf())
            .or_else(|| std::env::var("USERPROFILE").ok().map(PathBuf::from))
            .unwrap_or_else(|| PathBuf::from(".")),
    }
}

/// 根据 shell 类型构造 tokio Command
fn build_command(kind: ShellKind, command: &str, detached: bool) -> Command {
    match kind {
        ShellKind::Cmd => {
            let mut c = Command::new("cmd");
            if detached {
                c.arg("/c").arg("start").arg("").arg("/b").arg(command);
            } else {
                c.arg("/c").arg(command);
            }
            c
        }
        ShellKind::Pwsh => {
            let mut c = Command::new("powershell");
            c.arg("-NoProfile").arg("-Command").arg(command);
            c
        }
        ShellKind::Bash => {
            let mut c = Command::new("bash");
            c.arg("-c").arg(command);
            c
        }
    }
}

/// 执行 shell 命令（核心原语）
pub async fn execute_command(
    req: CommandRequest,
    project_dir: Option<&Path>,
) -> CommandResult {
    let kind = req.shell.unwrap_or_default();
    let cwd = resolve_dir(req.workdir.as_deref(), project_dir);

    let mut cmd = build_command(kind, &req.command, req.detached);
    cmd.current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());

    let run = async {
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                return Err(format!("无法启动命令: {}", e));
            }
        };

        let mut stdout_buf = Vec::new();
        let mut stderr_buf = Vec::new();

        let mut stdout = child.stdout.take();
        let mut stderr = child.stderr.take();

        let read_out = async {
            if let Some(mut o) = stdout.take() {
                let _ = o.read_to_end(&mut stdout_buf).await;
            }
        };
        let read_err = async {
            if let Some(mut e) = stderr.take() {
                let _ = e.read_to_end(&mut stderr_buf).await;
            }
        };

        tokio::join!(read_out, read_err);

        let status = child.wait().await;

        Ok::<_, String>((stdout_buf, stderr_buf, status))
    };

    match req.timeout_ms {
        Some(ms) if ms > 0 => {
            match tokio::time::timeout(Duration::from_millis(ms), run).await {
                Ok(Ok((out, err, status))) => {
                    let code = status.ok().and_then(|s| s.code());
                    finalize(out, err, code, false, Some(ms))
                }
                Ok(Err(e)) => build_error(e),
                Err(_) => build_timeout(ms),
            }
        }
        _ => match run.await {
            Ok((out, err, status)) => {
                let code = status.ok().and_then(|s| s.code());
                finalize(out, err, code, false, None)
            }
            Err(e) => build_error(e),
        },
    }
}

/// 组装最终结果
fn finalize(
    out: Vec<u8>,
    err: Vec<u8>,
    code: Option<i32>,
    timed_out: bool,
    timeout_ms: Option<u64>,
) -> CommandResult {
    let stdout = decode_output(&out);
    let stderr = decode_output(&err);
    let success = !timed_out && code == Some(0);
    let output = format_output(&stdout, &stderr, code, timed_out, timeout_ms);
    CommandResult {
        success,
        stdout,
        stderr,
        exit_code: code,
        timed_out,
        output,
    }
}

/// 组合输出文本（对齐 Electron 版 bash 工具格式）
fn format_output(
    stdout: &str,
    stderr: &str,
    code: Option<i32>,
    timed_out: bool,
    timeout_ms: Option<u64>,
) -> String {
    let nl = "\n";
    let mut body = stdout.to_string();
    if !stderr.is_empty() {
        if !body.is_empty() && !body.ends_with(nl) {
            body.push_str(nl);
        }
        body.push_str("[stderr]");
        body.push_str(nl);
        body.push_str(stderr);
    }
    if body.is_empty() {
        body.push_str("(no output)");
    }

    let mut markers = Vec::new();
    if timed_out {
        let ms = timeout_ms.unwrap_or(0);
        markers.push(format!("[timed out after {}ms]", ms));
    } else if let Some(c) = code {
        if c != 0 {
            markers.push(format!("[exit code: {}]", c));
        }
    }
    if !markers.is_empty() {
        if !body.ends_with(nl) {
            body.push_str(nl);
        }
        body.push_str(&markers.join(nl));
    }
    body
}

fn build_error(msg: String) -> CommandResult {
    CommandResult {
        success: false,
        stdout: String::new(),
        stderr: msg.clone(),
        exit_code: None,
        timed_out: false,
        output: msg,
    }
}

fn build_timeout(ms: u64) -> CommandResult {
    let marker = format!("[timed out after {}ms]", ms);
    CommandResult {
        success: false,
        stdout: String::new(),
        stderr: String::new(),
        exit_code: None,
        timed_out: true,
        output: marker,
    }
}
