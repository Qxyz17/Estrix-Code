//! shell 相关 Tauri command

use std::path::PathBuf;

use crate::shell::exec::{execute_command, CommandRequest, CommandResult};

/// 执行 shell 命令（核心原语）
///
/// 前端通过 invoke('execute_shell', { request: {...} }) 调用。
/// projectDir 由前端传入（当前绑定的项目目录）。
#[tauri::command]
pub async fn execute_shell(
    request: CommandRequest,
    project_dir: Option<String>,
) -> Result<CommandResult, String> {
    let pd = project_dir.map(PathBuf::from);
    Ok(execute_command(request, pd.as_deref()).await)
}
