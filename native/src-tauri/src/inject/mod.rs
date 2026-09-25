//! 注入层脚本管理
//!
//! 注入脚本是跑在 AI 平台页面里的 JS，职责是 DOM 操作：
//! 检测 estrix:bash / estrix:pwsh 代码块 -> 调用 Tauri command -> 显示结果。
//! 用 include_str! 在编译期嵌入，避免运行时读文件。

use crate::window::Platform;

/// 注入脚本原文（来自 inject.js）
const INJECT_JS: &str = include_str!("inject.js");

/// 构造完整的注入脚本（注入平台信息 + 基础脚本）
pub fn build_inject_script(platform: &Platform) -> String {
    let header = format!(
        "window.__ESTRIX_PLATFORM__ = {{ id: \"{}\", name: \"{}\" }};\n",
        platform.id, platform.name
    );
    format!("{}{}", header, INJECT_JS)
}
