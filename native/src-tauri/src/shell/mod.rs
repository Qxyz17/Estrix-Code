//! Shell 执行原语：cmd / powershell / bash 的统一封装
//!
//! 设计目标（见 native/ARCHITECTURE.md 第 4 节）：
//! - 一个原语 execute_command，支持超时 / 取消 / 输出编码处理
//! - 支持 detached 模式（对应 cmd /c start /b），长任务不被超时杀掉

pub mod exec;
pub mod decode;

#[cfg(test)]
mod tests;

pub use exec::{execute_command, CommandRequest, CommandResult, ShellKind};
