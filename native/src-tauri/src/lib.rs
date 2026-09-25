//! Estrix Code — Tauri (Rust) 版
//!
//! 架构见 native/ARCHITECTURE.md：
//! - 执行层：shell 原语 + 3 个原生文件工具（零 JS）
//! - AI 用专属标记 estrix:bash / estrix:pwsh 触发执行

pub mod commands;
pub mod inject;
pub mod shell;
pub mod window;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // 启动后创建加载 AI 平台页面的窗口
      let handle = app.handle().clone();
      std::thread::spawn(move || {
        // 等默认窗口初始化完成
        std::thread::sleep(std::time::Duration::from_millis(300));
        if let Err(e) = window::setup_main(&handle) {
          log::error!("创建平台窗口失败: {}", e);
        }
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::shell::execute_shell,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
