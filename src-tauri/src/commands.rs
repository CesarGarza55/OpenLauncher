use crate::paths::{get_launcher_state_path, get_minecraft_root};
use crate::services::auth::{get_microsoft_auth_state, login_microsoft_interactive, logout_microsoft, AuthAccountInfo};
use crate::services::content::{
    delete_content_file, import_content_file, open_content_folder, read_installed_content,
    read_installed_mods, set_all_mods_enabled, toggle_mod, ContentItem,
};
use crate::services::installer::{install_minecraft, read_installed_versions, InstalledVersionInfo};
use crate::services::instances::{
    create_instance, delete_instance, migrate_base_to_instance, parse_instance_payload,
    read_all_instances, scan_base_directory, update_instance, BaseScanResult, InstanceConfig,
};
use crate::services::modrinth::{
    check_installed_mods_updates, enrich_installed_content, get_modrinth_project, get_modrinth_project_versions,
    get_modrinth_version, install_modrinth_project, search_modrinth_projects,
};
use crate::services::news::{load_minecraft_article, load_minecraft_news};
use crate::services::runner::{launch_minecraft, stop_minecraft};
use crate::services::updater::{check_for_launcher_update, download_and_apply_update};
use crate::state::AppState;
use std::fs;
use std::sync::Arc;
use sysinfo::System;
use tauri::{AppHandle, Emitter, Manager, Window};

// ── Window Controls ──

#[tauri::command]
pub fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn window_maximize(window: Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn window_close(window: Window) -> Result<(), String> {
    use tauri_plugin_window_state::{AppHandleExt, StateFlags};
    let _ = window.app_handle().save_window_state(
        StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED,
    );
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn shell_open_external(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

// ── System and Paths ──

#[tauri::command]
pub fn minecraft_get_root() -> serde_json::Value {
    serde_json::json!({ "root": get_minecraft_root().to_string_lossy().to_string() })
}

#[tauri::command]
pub fn minecraft_open_root_directory() -> Result<serde_json::Value, String> {
    let root = get_minecraft_root();
    let _ = fs::create_dir_all(&root);
    open::that(&root).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "ok": true, "path": root.to_string_lossy().to_string() }))
}

#[tauri::command]
pub fn app_get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn system_get_info() -> serde_json::Value {
    let mut sys = System::new_all();
    sys.refresh_memory();
    let total_bytes = sys.total_memory();
    let total_ram_gb = (total_bytes as f64 / (1024.0 * 1024.0 * 1024.0)).round().max(2.0) as u32;

    serde_json::json!({
        "totalRamGb": total_ram_gb,
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
}

// ── State and Settings ──

#[tauri::command]
pub fn minecraft_get_state() -> serde_json::Value {
    let p = get_launcher_state_path();
    let mut state = if p.is_file() {
        fs::read_to_string(&p)
            .ok()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
            .unwrap_or_else(|| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    if let Some(obj) = state.as_object_mut() {
        obj.insert("minecraftRoot".to_string(), serde_json::Value::String(get_minecraft_root().to_string_lossy().to_string()));
    }
    state
}

#[tauri::command]
pub fn minecraft_save_state(state: serde_json::Value) -> Result<(), String> {
    let p = get_launcher_state_path();
    if let Some(parent) = p.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(p, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn minecraft_get_settings() -> serde_json::Value {
    let state = minecraft_get_state();
    let settings = state.get("settings");
    serde_json::json!({
        "keepOpen": settings.and_then(|s| s.get("keepOpen")).and_then(|v| v.as_bool()).unwrap_or(false),
        "showConsole": settings.and_then(|s| s.get("showConsole")).and_then(|v| v.as_bool()).unwrap_or(true),
        "autoUpdate": settings.and_then(|s| s.get("autoUpdate")).and_then(|v| v.as_bool()).unwrap_or(true),
        "showSnapshots": settings.and_then(|s| s.get("showSnapshots")).and_then(|v| v.as_bool()).unwrap_or(false),
    })
}

#[tauri::command]
pub fn app_get_language() -> String {
    let state = minecraft_get_state();
    state.get("settings")
        .and_then(|s| s.get("language"))
        .and_then(|v| v.as_str())
        .unwrap_or("en")
        .to_string()
}

#[tauri::command]
pub fn app_set_language(language: String) -> Result<(), String> {
    let mut state = minecraft_get_state();
    if let Some(obj) = state.as_object_mut() {
        let mut settings = obj.get("settings").cloned().unwrap_or_else(|| serde_json::json!({}));
        if let Some(s_obj) = settings.as_object_mut() {
            s_obj.insert("language".to_string(), serde_json::Value::String(language));
        }
        obj.insert("settings".to_string(), settings);
    }
    minecraft_save_state(state)
}

// ── Catalog and News ──

#[tauri::command]
pub async fn minecraft_get_catalog(_options: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let res = client.get(crate::services::installer::MOJANG_MANIFEST_URL)
        .send().await.map_err(|e| e.to_string())?
        .json::<serde_json::Value>().await.map_err(|e| e.to_string())?;

    let latest = res.get("latest").cloned().unwrap_or_else(|| serde_json::json!({}));
    let versions = res.get("versions").cloned().unwrap_or_else(|| serde_json::json!([]));

    Ok(serde_json::json!({
        "latest": latest,
        "versions": versions,
        "installTargets": {
            "minecraft": { "title": "Install Minecraft", "versions": versions },
            "fabric": { "title": "Install Fabric", "versions": [] },
            "forge": { "title": "Install Forge", "versions": [] }
        },
    }))
}

#[tauri::command]
pub async fn minecraft_get_news(options: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    let limit = options.as_ref()
        .and_then(|o| o.get("limit"))
        .and_then(|l| l.as_u64())
        .unwrap_or(60) as usize;
    let resp = load_minecraft_news(limit).await?;
    Ok(serde_json::to_value(resp).unwrap())
}

#[tauri::command]
pub async fn minecraft_get_article(url: String) -> Result<serde_json::Value, String> {
    load_minecraft_article(&url).await
}

// ── Authentication ──

#[tauri::command]
pub fn minecraft_get_auth_state(profile_key: Option<String>) -> Option<AuthAccountInfo> {
    let key = profile_key.unwrap_or_else(|| "default".to_string());
    get_microsoft_auth_state(&key)
}

#[tauri::command]
pub async fn minecraft_login(profile_key: Option<String>) -> Result<AuthAccountInfo, String> {
    let key = profile_key.unwrap_or_else(|| "default".to_string());
    login_microsoft_interactive(&key).await
}

#[tauri::command]
pub fn minecraft_logout(profile_key: Option<String>) -> Result<(), String> {
    let key = profile_key.unwrap_or_else(|| "default".to_string());
    logout_microsoft(&key)
}

// ── Instances ──

#[tauri::command]
pub fn instances_get_all() -> Vec<InstanceConfig> {
    read_all_instances()
}

#[tauri::command]
pub fn instances_create(payload: serde_json::Value) -> Result<serde_json::Value, String> {
    let config = parse_instance_payload(&payload)?;
    let instance = create_instance(config)?;
    Ok(serde_json::json!({
        "ok": true,
        "instance": instance
    }))
}

#[tauri::command]
pub fn instances_update(id: String, updates: serde_json::Value) -> Result<serde_json::Value, String> {
    let instance = update_instance(&id, updates)?;
    Ok(serde_json::json!({
        "ok": true,
        "instance": instance
    }))
}

#[tauri::command]
pub fn instances_delete(id: String) -> Result<serde_json::Value, String> {
    let deleted_id = delete_instance(&id)?;
    Ok(serde_json::json!({
        "ok": true,
        "id": deleted_id
    }))
}

#[tauri::command]
pub fn instances_scan_base() -> BaseScanResult {
    scan_base_directory()
}

#[tauri::command]
pub fn instances_migrate_base(payload: serde_json::Value) -> Result<serde_json::Value, String> {
    let config = parse_instance_payload(&payload)?;
    let instance = migrate_base_to_instance(config)?;
    Ok(serde_json::json!({
        "ok": true,
        "instance": instance
    }))
}

#[tauri::command]
pub fn instances_read_image_data_uri(path: String) -> Result<String, String> {
    let p = std::path::Path::new(&path);
    if !p.is_file() {
        return Err("File not found".to_string());
    }
    let bytes = std::fs::read(p).map_err(|e| e.to_string())?;
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("png").to_lowercase();
    let mime = if ext == "svg" { "image/svg+xml" } else if ext == "jpg" { "image/jpeg" } else { &format!("image/{}", ext) };
    let b64 = crate::services::instances::base64_encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

// ── Content Management ──

#[tauri::command]
pub fn minecraft_get_installed_versions() -> Vec<InstalledVersionInfo> {
    read_installed_versions()
}

#[tauri::command]
pub fn minecraft_get_installed_mods(instance_id: Option<String>) -> Vec<ContentItem> {
    read_installed_mods(instance_id.as_deref())
}

#[tauri::command]
pub fn minecraft_get_installed_shaders(instance_id: Option<String>) -> Vec<ContentItem> {
    read_installed_content("shaderpacks", instance_id.as_deref())
}

#[tauri::command]
pub fn minecraft_get_installed_resourcepacks(instance_id: Option<String>) -> Vec<ContentItem> {
    read_installed_content("resourcepacks", instance_id.as_deref())
}

#[tauri::command]
pub fn minecraft_get_installed_datapacks(instance_id: Option<String>) -> Vec<ContentItem> {
    read_installed_content("datapacks", instance_id.as_deref())
}

#[tauri::command]
pub async fn minecraft_modrinth_enrich_installed_content(items: Vec<ContentItem>, project_type: String) -> Vec<ContentItem> {
    let project_type = match project_type.as_str() {
        "mod" => "mod",
        "shader" => "shader",
        "resourcepack" => "resourcepack",
        "datapack" => "datapack",
        _ => return items,
    };
    enrich_installed_content(items, project_type).await
}

#[tauri::command]
pub fn minecraft_toggle_mod(mod_id: String, enable: bool, instance_id: Option<String>) -> Result<(), String> {
    toggle_mod(&mod_id, enable, instance_id.as_deref())
}

#[tauri::command]
pub fn minecraft_set_all_mods_enabled(enable: bool, instance_id: Option<String>) -> Result<(), String> {
    set_all_mods_enabled(enable, instance_id.as_deref())
}

#[tauri::command]
pub fn minecraft_delete_mod(mod_id: String, instance_id: Option<String>) -> Result<(), String> {
    delete_content_file("mods", &mod_id, instance_id.as_deref())
}

#[tauri::command]
pub fn minecraft_delete_shader(file_name: String, instance_id: Option<String>) -> Result<(), String> {
    delete_content_file("shaderpacks", &file_name, instance_id.as_deref())
}

#[tauri::command]
pub fn minecraft_delete_resourcepack(file_name: String, instance_id: Option<String>) -> Result<(), String> {
    delete_content_file("resourcepacks", &file_name, instance_id.as_deref())
}

#[tauri::command]
pub fn minecraft_delete_datapack(file_name: String, instance_id: Option<String>) -> Result<(), String> {
    delete_content_file("datapacks", &file_name, instance_id.as_deref())
}

#[tauri::command]
pub fn minecraft_open_content_folder(folder_type: String, instance_id: Option<String>) -> Result<(), String> {
    let folder_name = match folder_type.as_str() {
        "shader" | "shaders" => "shaderpacks",
        "resourcepack" | "resourcepacks" => "resourcepacks",
        "datapack" | "datapacks" => "datapacks",
        _ => "mods",
    };
    open_content_folder(folder_name, instance_id.as_deref())
}

#[tauri::command]
pub fn minecraft_install_mod_file(source_path: String, instance_id: Option<String>) -> Result<ContentItem, String> {
    import_content_file(&source_path, "mods", instance_id.as_deref())
}

#[tauri::command]
pub fn minecraft_import_content_file(payload: serde_json::Value, instance_id: Option<String>) -> Result<serde_json::Value, String> {
    let source_path = payload.get("sourcePath")
        .or_else(|| payload.get("path"))
        .and_then(|v| v.as_str())
        .ok_or("Missing sourcePath")?;
    let folder_type = payload.get("folderType")
        .or_else(|| payload.get("type"))
        .and_then(|v| v.as_str())
        .unwrap_or("mods");
    let folder_name = match folder_type {
        "shader" | "shaders" | "shaderpacks" => "shaderpacks",
        "resourcepack" | "resourcepacks" | "texturepack" | "textures" => "resourcepacks",
        "datapack" | "datapacks" => "datapacks",
        _ => "mods",
    };
    let inst_id = instance_id.or_else(|| payload.get("instanceId").and_then(|v| v.as_str()).map(str::to_string));
    let item = import_content_file(source_path, folder_name, inst_id.as_deref())?;
    Ok(serde_json::json!({
        "ok": true,
        "path": item.path,
        "fileName": item.file_name,
        "item": item
    }))
}

// ── Modrinth ──

#[tauri::command]
pub async fn minecraft_modrinth_search(params: serde_json::Value) -> Result<serde_json::Value, String> {
    search_modrinth_projects(params).await
}

#[tauri::command]
pub async fn minecraft_modrinth_get_project(id_or_slug: String) -> Result<serde_json::Value, String> {
    get_modrinth_project(&id_or_slug).await
}

#[tauri::command]
pub async fn minecraft_modrinth_get_versions(params: serde_json::Value) -> Result<serde_json::Value, String> {
    get_modrinth_project_versions(params).await
}

#[tauri::command]
pub async fn minecraft_modrinth_get_version(version_id: String) -> Result<serde_json::Value, String> {
    get_modrinth_version(&version_id).await
}

#[tauri::command]
pub async fn minecraft_modrinth_install(payload: serde_json::Value) -> Result<serde_json::Value, String> {
    install_modrinth_project(payload).await
}

#[tauri::command]
pub async fn minecraft_check_mod_updates(params: serde_json::Value) -> Result<serde_json::Value, String> {
    check_installed_mods_updates(params).await
}

// ── Game Installation and Run ──

#[tauri::command]
pub async fn minecraft_install(opts: serde_json::Value, app_handle: AppHandle) -> Result<serde_json::Value, String> {
    let version_val = opts.get("versionId").or_else(|| opts.get("version"));
    let version_id = match version_val {
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(serde_json::Value::Object(o)) => o.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        _ => "".to_string(),
    };
    if version_id.is_empty() {
        return Err("Missing versionId".to_string());
    }
    let loader = opts.get("loader").and_then(|v| v.as_str());
    let mc_ver = opts.get("mcVer").and_then(|v| v.as_str());
    let install_id = opts.get("installId").and_then(|v| v.as_str()).unwrap_or("default");

    match install_minecraft(&version_id, loader, mc_ver, install_id, &app_handle).await {
        Ok(id) => Ok(serde_json::json!({ "installId": install_id, "versionId": id })),
        Err(err) => {
            let _ = app_handle.emit(
                "minecraft:install-error",
                serde_json::json!({ "installId": install_id, "error": err }),
            );
            Err(err)
        }
    }
}

#[tauri::command]
pub fn minecraft_install_cancel(install_id: String, app_handle: AppHandle) -> Result<serde_json::Value, String> {
    let _ = app_handle.emit(
        "minecraft:install-cancelled",
        serde_json::json!({ "installId": install_id }),
    );
    Ok(serde_json::json!({ "installId": install_id, "cancelled": true }))
}

#[tauri::command]
pub async fn minecraft_run(
    opts: serde_json::Value,
    app_handle: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let pid = launch_minecraft(opts, app_handle, state.inner().clone()).await?;
    Ok(serde_json::json!({ "pid": pid }))
}

#[tauri::command]
pub async fn minecraft_stop(pid: Option<u32>, state: tauri::State<'_, Arc<AppState>>) -> Result<(), String> {
    if let Some(p) = pid {
        stop_minecraft(p, state.inner().clone()).await?;
    }
    Ok(())
}

// ── Updater ──

#[tauri::command]
pub async fn minecraft_check_update(app_handle: AppHandle) -> Result<serde_json::Value, String> {
    check_for_launcher_update(&app_handle).await
}

#[tauri::command]
pub async fn minecraft_apply_update(payload: serde_json::Value, app_handle: AppHandle) -> Result<serde_json::Value, String> {
    download_and_apply_update(&app_handle, payload).await
}
