mod commands;
mod deepseek;
mod error;
mod exif_meta;
mod fsutil;
mod git;
mod image_pipeline;
mod manifest;
mod secrets;
mod settings;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .try_init();

    let state = AppState::new().expect("无法初始化照片日历编辑器");
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::settings_get,
            commands::settings_save,
            commands::secret_status,
            commands::secret_set,
            commands::secret_clear,
            commands::settings_test_deepseek,
            commands::settings_test_git,
            commands::repo_validate,
            commands::entries_list,
            commands::entry_get,
            commands::entry_image,
            commands::entry_delete,
            commands::caption_save,
            commands::photos_preview_import,
            commands::caption_generate,
            commands::entry_save,
            commands::git_status,
            commands::git_publish,
        ])
        .run(tauri::generate_context!())
        .expect("运行照片日历编辑器失败");
}
