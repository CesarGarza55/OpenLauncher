pub mod commands;
pub mod paths;
pub mod services;
pub mod state;

use state::AppState;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Arc::new(AppState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_filename("window-state.json")
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .build(),
        )
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Window controls
            commands::window_minimize,
            commands::window_maximize,
            commands::window_close,
            commands::shell_open_external,

            // System and paths
            commands::minecraft_get_root,
            commands::minecraft_open_root_directory,
            commands::app_get_version,
            commands::system_get_info,

            // State & Settings
            commands::minecraft_get_state,
            commands::minecraft_save_state,
            commands::minecraft_get_settings,
            commands::app_get_language,
            commands::app_set_language,

            // Catalog & News
            commands::minecraft_get_catalog,
            commands::minecraft_get_news,
            commands::minecraft_get_article,

            // Auth
            commands::minecraft_get_auth_state,
            commands::minecraft_login,
            commands::minecraft_logout,

            // Instances
            commands::instances_get_all,
            commands::instances_create,
            commands::instances_update,
            commands::instances_delete,
            commands::instances_scan_base,
            commands::instances_migrate_base,
            commands::instances_read_image_data_uri,

            // Content
            commands::minecraft_get_installed_versions,
            commands::minecraft_get_installed_mods,
            commands::minecraft_get_installed_shaders,
            commands::minecraft_get_installed_resourcepacks,
            commands::minecraft_get_installed_datapacks,
            commands::minecraft_modrinth_enrich_installed_content,
            commands::minecraft_toggle_mod,
            commands::minecraft_set_all_mods_enabled,
            commands::minecraft_delete_mod,
            commands::minecraft_delete_shader,
            commands::minecraft_delete_resourcepack,
            commands::minecraft_delete_datapack,
            commands::minecraft_open_content_folder,
            commands::minecraft_install_mod_file,
            commands::minecraft_import_content_file,

            // Modrinth
            commands::minecraft_modrinth_search,
            commands::minecraft_modrinth_get_project,
            commands::minecraft_modrinth_get_versions,
            commands::minecraft_modrinth_get_version,
            commands::minecraft_modrinth_install,
            commands::minecraft_check_mod_updates,

            // Installation & Run
            commands::minecraft_install,
            commands::minecraft_install_cancel,
            commands::minecraft_run,
            commands::minecraft_stop,

            // Updater
            commands::minecraft_check_update,
            commands::minecraft_apply_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
