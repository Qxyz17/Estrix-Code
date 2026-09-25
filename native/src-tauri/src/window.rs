//! 窗口管理：创建加载 AI 平台页面的 WebView 窗口，并注入覆盖层脚本

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

use crate::inject;

/// AI 平台定义（Phase 1 先内置 DeepSeek）
#[derive(Debug, Clone)]
pub struct Platform {
    pub id: &'static str,
    pub name: &'static str,
    pub home_url: &'static str,
}

pub const PLATFORMS: &[Platform] = &[
    Platform {
        id: "deepseek",
        name: "DeepSeek",
        home_url: "https://chat.deepseek.com/",
    },
    Platform {
        id: "claude",
        name: "Claude",
        home_url: "https://claude.ai/",
    },
];

pub fn find_platform(id: &str) -> Option<&'static Platform> {
    PLATFORMS.iter().find(|p| p.id == id)
}

/// 创建一个加载指定平台的窗口，并注入覆盖层
pub fn create_platform_window(
    app: &tauri::AppHandle,
    platform_id: &str,
    label: &str,
) -> Result<(), String> {
    let platform = find_platform(platform_id)
        .ok_or_else(|| format!("未知平台: {}", platform_id))?;

    let url = platform
        .home_url
        .parse()
        .map_err(|e| format!("URL 解析失败: {}", e))?;

    let script = inject::build_inject_script(platform);

    let _win = WebviewWindowBuilder::new(app, label, WebviewUrl::External(url))
        .title(format!("Estrix Code - {}", platform.name))
        .inner_size(1280.0, 900.0)
        .initialization_script(&script)
        .build()
        .map_err(|e| format!("创建窗口失败: {}", e))?;

    Ok(())
}

/// 确保主窗口存在（Phase 1：直接用平台窗口替代本地骨架）
pub fn setup_main(app: &tauri::AppHandle) -> Result<(), String> {
    // 关闭默认本地窗口后，创建一个平台窗口
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.close();
    }
    create_platform_window(app, "deepseek", "platform-deepseek")
}
