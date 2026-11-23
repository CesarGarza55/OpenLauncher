use std::path::PathBuf;

pub fn get_home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
}

pub fn get_minecraft_root() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Some(app_data) = dirs::data_dir() {
            app_data.join(".minecraft")
        } else {
            get_home_dir().join("AppData").join("Roaming").join(".minecraft")
        }
    }
    #[cfg(target_os = "macos")]
    {
        get_home_dir().join("Library").join("Application Support").join("minecraft")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        get_home_dir().join(".minecraft")
    }
}

pub fn get_launcher_data_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Some(app_data) = dirs::data_dir() {
            app_data.join("OpenLauncher")
        } else {
            get_home_dir().join("AppData").join("Roaming").join("OpenLauncher")
        }
    }
    #[cfg(target_os = "macos")]
    {
        get_home_dir().join("Library").join("Application Support").join("OpenLauncher")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        if let Some(config_dir) = dirs::config_dir() {
            config_dir.join("OpenLauncher")
        } else {
            get_home_dir().join(".config").join("OpenLauncher")
        }
    }
}

pub fn get_instances_dir() -> PathBuf {
    get_minecraft_root().join("instances")
}

pub fn get_instance_dir(id: &str) -> PathBuf {
    get_instances_dir().join(id)
}

pub fn get_target_game_dir(instance_id: Option<&str>) -> PathBuf {
    match instance_id {
        Some(id) if !id.trim().is_empty() && id != "default" => get_instance_dir(id),
        _ => get_minecraft_root(),
    }
}

pub fn get_launcher_state_path() -> PathBuf {
    get_launcher_data_dir().join("launcher-state.json")
}

pub fn get_auth_store_path() -> PathBuf {
    get_launcher_data_dir().join("auth-store.json")
}
