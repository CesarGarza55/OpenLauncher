use crate::paths::{get_instance_dir, get_instances_dir, get_minecraft_root};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

pub const DEFAULT_INSTANCE_ICON: &str = "grass";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstanceConfig {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub version: String,
    #[serde(default = "default_loader")]
    pub loader: String,
    #[serde(default = "default_icon")]
    pub icon: String,
    #[serde(default, alias = "custom_icon")]
    pub custom_icon: Option<String>,
    #[serde(default = "default_ram")]
    pub ram: u32,
    #[serde(default, alias = "jvm_args")]
    pub jvm_args: Option<String>,
    #[serde(default, alias = "java_path")]
    pub java_path: Option<String>,
    #[serde(default)]
    pub created: u64,
    #[serde(default, alias = "last_played")]
    pub last_played: u64,
    #[serde(default, alias = "mods_count")]
    pub mods_count: usize,
    #[serde(default, alias = "include", skip_serializing)]
    pub migration_include: Vec<String>,
    #[serde(default, alias = "move", skip_serializing)]
    pub migration_move: bool,
}

fn default_loader() -> String {
    "vanilla".to_string()
}
fn default_icon() -> String {
    DEFAULT_INSTANCE_ICON.to_string()
}
fn default_ram() -> u32 {
    4
}

pub fn sanitize_instance_id(name: &str) -> String {
    let mut sanitized = String::new();
    let mut prev_dash = false;
    for ch in name.to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
            sanitized.push(ch);
            prev_dash = ch == '-';
        } else if !prev_dash {
            sanitized.push('-');
            prev_dash = true;
        }
    }
    let trimmed = sanitized.trim_matches('-');
    if trimmed.is_empty() {
        format!("instance-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis())
    } else {
        trimmed.to_string()
    }
}

pub fn detect_loader_from_version(ver: &str) -> String {
    let lower = ver.to_lowercase();
    if lower.contains("fabric") {
        "fabric".to_string()
    } else if lower.contains("neoforge") {
        "neoforge".to_string()
    } else if lower.contains("forge") {
        "forge".to_string()
    } else if lower.contains("quilt") {
        "quilt".to_string()
    } else {
        "vanilla".to_string()
    }
}

pub fn get_custom_icon_data_uri(instance_path: &Path) -> Option<String> {
    let icon_files = ["icon.png", "icon.jpg", "icon.jpeg", "icon.webp", "icon.svg"];
    for name in &icon_files {
        let full = instance_path.join(name);
        if full.is_file() {
            if let Ok(bytes) = fs::read(&full) {
                let ext = full.extension().and_then(|e| e.to_str()).unwrap_or("png").to_lowercase();
                let mime = if ext == "svg" {
                    "image/svg+xml"
                } else if ext == "jpg" {
                    "image/jpeg"
                } else {
                    &format!("image/{}", ext)
                };
                let b64 = base64_encode(&bytes);
                return Some(format!("data:{};base64,{}", mime, b64));
            }
        }
    }
    None
}

pub fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    let mut i = 0;
    while i < data.len() {
        let b0 = data[i] as usize;
        let b1 = if i + 1 < data.len() { data[i + 1] as usize } else { 0 };
        let b2 = if i + 2 < data.len() { data[i + 2] as usize } else { 0 };

        let triple = (b0 << 16) | (b1 << 8) | b2;

        result.push(CHARS[(triple >> 18) & 0x3F] as char);
        result.push(CHARS[(triple >> 12) & 0x3F] as char);
        result.push(if i + 1 < data.len() { CHARS[(triple >> 6) & 0x3F] as char } else { '=' });
        result.push(if i + 2 < data.len() { CHARS[triple & 0x3F] as char } else { '=' });

        i += 3;
    }
    result
}

fn base64_decode(data: &str) -> Option<Vec<u8>> {
    let trimmed = data.trim();
    if trimmed.is_empty() || trimmed.len() % 4 != 0 {
        return None;
    }

    let decode_char = |c: u8| -> Option<u8> {
        match c {
            b'A'..=b'Z' => Some(c - b'A'),
            b'a'..=b'z' => Some(c - b'a' + 26),
            b'0'..=b'9' => Some(c - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            b'=' => Some(0),
            _ => None,
        }
    };

    let mut out = Vec::with_capacity(trimmed.len() * 3 / 4);
    let bytes = trimmed.as_bytes();

    for chunk in bytes.chunks(4) {
        let b0 = decode_char(chunk[0])? as u32;
        let b1 = decode_char(chunk[1])? as u32;
        let b2 = decode_char(chunk[2])? as u32;
        let b3 = decode_char(chunk[3])? as u32;

        let triple = (b0 << 18) | (b1 << 12) | (b2 << 6) | b3;

        out.push(((triple >> 16) & 0xFF) as u8);
        if chunk[2] != b'=' {
            out.push(((triple >> 8) & 0xFF) as u8);
        }
        if chunk[3] != b'=' {
            out.push((triple & 0xFF) as u8);
        }
    }
    Some(out)
}

pub fn save_custom_icon_file(instance_path: &Path, data_uri: &str) {
    if !data_uri.starts_with("data:image/") {
        return;
    }
    let parts: Vec<&str> = data_uri.split(";base64,").collect();
    if parts.len() != 2 {
        return;
    }
    let header = parts[0];
    let b64_data = parts[1];

    let ext = if header.contains("jpeg") || header.contains("jpg") {
        "jpg"
    } else if header.contains("webp") {
        "webp"
    } else if header.contains("svg") {
        "svg"
    } else {
        "png"
    };

    if let Some(decoded) = base64_decode(b64_data) {
        let possible_icons = ["icon.png", "icon.jpg", "icon.jpeg", "icon.webp", "icon.svg"];
        for name in &possible_icons {
            let p = instance_path.join(name);
            if p.exists() {
                let _ = fs::remove_file(p);
            }
        }
        let target = instance_path.join(format!("icon.{}", ext));
        let _ = fs::write(target, decoded);
    }
}

pub fn read_all_instances() -> Vec<InstanceConfig> {
    let base_dir = get_instances_dir();
    let _ = fs::create_dir_all(&base_dir);

    let mut instances = Vec::new();
    if let Ok(entries) = fs::read_dir(&base_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let id = entry.file_name().to_string_lossy().to_string();
                let instance_path = entry.path();
                let config_path = instance_path.join("instance.json");

                let mut config = if config_path.is_file() {
                    fs::read_to_string(&config_path)
                        .ok()
                        .and_then(|s| serde_json::from_str::<InstanceConfig>(&s).ok())
                        .unwrap_or_else(|| InstanceConfig {
                            id: id.clone(),
                            name: id.clone(),
                            version: "1.21.1".to_string(),
                            loader: "vanilla".to_string(),
                            icon: DEFAULT_INSTANCE_ICON.to_string(),
                            custom_icon: None,
                            ram: 4,
                            jvm_args: None,
                            java_path: None,
                            created: 0,
                            last_played: 0,
                            mods_count: 0,
                            migration_include: Vec::new(),
                            migration_move: false,
                        })
                } else {
                    InstanceConfig {
                        id: id.clone(),
                        name: id.clone(),
                        version: "1.21.1".to_string(),
                        loader: "vanilla".to_string(),
                        icon: DEFAULT_INSTANCE_ICON.to_string(),
                        custom_icon: None,
                        ram: 4,
                        jvm_args: None,
                        java_path: None,
                        created: 0,
                        last_played: 0,
                        mods_count: 0,
                        migration_include: Vec::new(),
                        migration_move: false,
                    }
                };

                let mods_dir = instance_path.join("mods");
                let mut count = 0;
                if let Ok(files) = fs::read_dir(mods_dir) {
                    for f in files.flatten() {
                        let name = f.file_name().to_string_lossy().to_lowercase();
                        if f.path().is_file() && (name.ends_with(".jar") || name.ends_with(".jar.disabled") || name.ends_with(".olpkg")) {
                            count += 1;
                        }
                    }
                }
                config.mods_count = count;

                if config.loader == "vanilla" || config.loader.is_empty() {
                    config.loader = detect_loader_from_version(&config.version);
                }

                config.custom_icon = get_custom_icon_data_uri(&instance_path);
                instances.push(config);
            }
        }
    }
    instances.sort_by(|a, b| b.created.cmp(&a.created));
    instances
}

pub fn parse_instance_payload(payload: &serde_json::Value) -> Result<InstanceConfig, String> {
    let name = payload
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if name.is_empty() {
        return Err("Instance name cannot be empty".to_string());
    }

    let id = payload
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let version = payload
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("1.21.1")
        .trim()
        .to_string();
    let loader = payload
        .get("loader")
        .and_then(|v| v.as_str())
        .unwrap_or("vanilla")
        .to_string();
    let icon = payload
        .get("icon")
        .and_then(|v| v.as_str())
        .unwrap_or(DEFAULT_INSTANCE_ICON)
        .to_string();
    let custom_icon = payload
        .get("customIcon")
        .or_else(|| payload.get("custom_icon"))
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let ram = payload
        .get("ram")
        .and_then(|v| v.as_u64())
        .unwrap_or(4) as u32;
    let jvm_args = payload
        .get("jvmArgs")
        .or_else(|| payload.get("jvm_args"))
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let java_path = payload
        .get("javaPath")
        .or_else(|| payload.get("java_path"))
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let created = payload
        .get("created")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let last_played = payload
        .get("lastPlayed")
        .or_else(|| payload.get("last_played"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    let mods_count = payload
        .get("modsCount")
        .or_else(|| payload.get("mods_count"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as usize;

    let migration_include: Vec<String> = payload
        .get("migrationInclude")
        .or_else(|| payload.get("include"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();

    let migration_move = payload
        .get("migrationMove")
        .or_else(|| payload.get("move"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    Ok(InstanceConfig {
        id,
        name: name.to_string(),
        version,
        loader,
        icon,
        custom_icon,
        ram,
        jvm_args,
        java_path,
        created,
        last_played,
        mods_count,
        migration_include,
        migration_move,
    })
}

pub fn create_instance(mut payload: InstanceConfig) -> Result<InstanceConfig, String> {
    let raw_name = payload.name.trim();
    if raw_name.is_empty() {
        return Err("Instance name cannot be empty".to_string());
    }

    let mut id = if !payload.id.trim().is_empty() {
        payload.id.trim().to_string()
    } else {
        sanitize_instance_id(raw_name)
    };

    if get_instance_dir(&id).exists() {
        let base_id = id.clone();
        let mut counter = 2;
        while get_instance_dir(&format!("{}-{}", base_id, counter)).exists() {
            counter += 1;
        }
        id = format!("{}-{}", base_id, counter);
    }

    let instance_dir = get_instance_dir(&id);
    fs::create_dir_all(&instance_dir).map_err(|e| e.to_string())?;

    payload.id = id;
    if payload.version.is_empty() {
        payload.version = "1.21.1".to_string();
    }
    if payload.loader.is_empty() || payload.loader == "vanilla" {
        payload.loader = detect_loader_from_version(&payload.version);
    }
    if payload.icon.is_empty() {
        payload.icon = DEFAULT_INSTANCE_ICON.to_string();
    }
    if payload.ram == 0 {
        payload.ram = 4;
    }
    if payload.created == 0 {
        payload.created = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
    }

    if let Some(ref custom_icon) = payload.custom_icon {
        save_custom_icon_file(&instance_dir, custom_icon);
    }

    let config_path = instance_dir.join("instance.json");
    let json = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
    fs::write(config_path, json).map_err(|e| e.to_string())?;

    let subdirs = ["mods", "resourcepacks", "shaderpacks", "saves", "config"];
    for sub in &subdirs {
        let _ = fs::create_dir_all(instance_dir.join(sub));
    }

    Ok(payload)
}

pub fn update_instance(id: &str, updates: serde_json::Value) -> Result<InstanceConfig, String> {
    let instance_dir = get_instance_dir(id);
    if !instance_dir.exists() {
        return Err("Instance not found".to_string());
    }

    let config_path = instance_dir.join("instance.json");
    let mut config: InstanceConfig = if config_path.is_file() {
        let s = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&s).unwrap_or_else(|_| InstanceConfig {
            id: id.to_string(),
            name: id.to_string(),
            version: "1.21.1".to_string(),
            loader: "vanilla".to_string(),
            icon: DEFAULT_INSTANCE_ICON.to_string(),
            custom_icon: None,
            ram: 4,
            jvm_args: None,
            java_path: None,
            created: 0,
            last_played: 0,
            mods_count: 0,
            migration_include: Vec::new(),
            migration_move: false,
        })
    } else {
        return Err("instance.json not found".to_string());
    };

    if let Some(obj) = updates.as_object() {
        if let Some(v) = obj.get("name").and_then(|v| v.as_str()) {
            config.name = v.to_string();
        }
        if let Some(v) = obj.get("version").and_then(|v| v.as_str()) {
            config.version = v.to_string();
        }
        if let Some(v) = obj.get("loader").and_then(|v| v.as_str()) {
            config.loader = v.to_string();
        }
        if let Some(v) = obj.get("icon").and_then(|v| v.as_str()) {
            config.icon = v.to_string();
        }
        if let Some(v) = obj.get("ram").and_then(|v| v.as_u64()) {
            config.ram = v as u32;
        }
        if let Some(v) = obj.get("jvmArgs").and_then(|v| v.as_str()) {
            config.jvm_args = Some(v.to_string());
        }
        if let Some(v) = obj.get("javaPath").and_then(|v| v.as_str()) {
            config.java_path = Some(v.to_string());
        }
        if let Some(v) = obj.get("customIcon").and_then(|v| v.as_str()) {
            save_custom_icon_file(&instance_dir, v);
            config.custom_icon = Some(v.to_string());
        }
    }

    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(config_path, json).map_err(|e| e.to_string())?;
    config.custom_icon = get_custom_icon_data_uri(&instance_dir);

    Ok(config)
}

pub fn delete_instance(id: &str) -> Result<String, String> {
    let instance_dir = get_instance_dir(id);
    if instance_dir.exists() {
        fs::remove_dir_all(&instance_dir).map_err(|e| e.to_string())?;
    }
    Ok(id.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BaseScanResult {
    pub mods_count: usize,
    pub shaderpacks_count: usize,
    pub resourcepacks_count: usize,
    pub saves_count: usize,
    pub has_config: bool,
    pub has_options: bool,
}

pub fn scan_base_directory() -> BaseScanResult {
    let root = get_minecraft_root();
    let count_files = |sub: &str| -> usize {
        let p = root.join(sub);
        if let Ok(entries) = fs::read_dir(p) {
            entries.flatten().count()
        } else {
            0
        }
    };

    BaseScanResult {
        mods_count: count_files("mods"),
        shaderpacks_count: count_files("shaderpacks"),
        resourcepacks_count: count_files("resourcepacks"),
        saves_count: count_files("saves"),
        has_config: root.join("config").exists(),
        has_options: root.join("options.txt").exists(),
    }
}

pub fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

pub fn migrate_base_to_instance(payload: InstanceConfig) -> Result<InstanceConfig, String> {
    let include = payload.migration_include.clone();
    let move_files = payload.migration_move;
    let instance = create_instance(payload)?;
    let target_dir = get_instance_dir(&instance.id);
    let root = get_minecraft_root();

    let folders = ["mods", "resourcepacks", "shaderpacks", "config", "saves"];
    for folder in &folders {
        if !include.is_empty() && !include.iter().any(|item| item == folder) { continue; }
        let src = root.join(folder);
        let dst = target_dir.join(folder);
        if src.is_dir() {
            if move_files {
                fs::rename(&src, &dst).or_else(|_| { copy_dir_all(&src, &dst)?; fs::remove_dir_all(&src) })
                    .map_err(|e| format!("Could not move {}: {}", folder, e))?;
            } else {
                copy_dir_all(&src, &dst).map_err(|e| format!("Could not copy {}: {}", folder, e))?;
            }
        }
    }

    let options_file = root.join("options.txt");
    if (include.is_empty() || include.iter().any(|item| item == "options")) && options_file.is_file() {
        if move_files {
            fs::rename(&options_file, target_dir.join("options.txt")).or_else(|_| { fs::copy(&options_file, target_dir.join("options.txt"))?; fs::remove_file(&options_file) })
                .map_err(|e| format!("Could not move options.txt: {}", e))?;
        } else {
            fs::copy(options_file, target_dir.join("options.txt")).map_err(|e| format!("Could not copy options.txt: {}", e))?;
        }
    }

    Ok(instance)
}
