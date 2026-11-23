use crate::paths::{get_launcher_data_dir, get_target_game_dir};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

pub fn get_metadata_store_path() -> PathBuf {
    get_launcher_data_dir().join("mods-metadata.json")
}

pub fn read_metadata_store() -> HashMap<String, serde_json::Value> {
    let path = get_metadata_store_path();
    if let Ok(data) = fs::read_to_string(path) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        HashMap::new()
    }
}

pub fn save_metadata_store(entries: &HashMap<String, serde_json::Value>) {
    let path = get_metadata_store_path();
    let mut current = read_metadata_store();
    for (k, v) in entries {
        current.insert(k.clone(), v.clone());
    }
    if let Ok(json_str) = serde_json::to_string_pretty(&current) {
        let _ = fs::create_dir_all(get_launcher_data_dir());
        let _ = fs::write(path, json_str);
    }
}

pub fn extract_text_component(val: &serde_json::Value) -> String {
    match val {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Array(arr) => arr
            .iter()
            .map(extract_text_component)
            .collect::<Vec<_>>()
            .join(""),
        serde_json::Value::Object(map) => {
            let mut result = String::new();
            if let Some(fb) = map.get("fallback").and_then(|v| v.as_str()) {
                result.push_str(fb);
            } else if let Some(txt) = map.get("text").and_then(|v| v.as_str()) {
                result.push_str(txt);
            } else if let Some(tr) = map.get("translate").and_then(|v| v.as_str()) {
                result.push_str(tr);
            }
            if let Some(extra) = map.get("extra") {
                result.push_str(&extract_text_component(extra));
            }
            if let Some(with) = map.get("with").and_then(|v| v.as_array()) {
                result.push(' ');
                result.push_str(
                    &with
                        .iter()
                        .map(extract_text_component)
                        .collect::<Vec<_>>()
                        .join(" "),
                );
            }
            result
        }
        _ => String::new(),
    }
}

pub fn clean_minecraft_text(raw: &str) -> String {
    let trimmed = raw.trim();
    let text = if (trimmed.starts_with('{') && trimmed.ends_with('}'))
        || (trimmed.starts_with('[') && trimmed.ends_with(']'))
    {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
            extract_text_component(&val)
        } else {
            raw.to_string()
        }
    } else {
        raw.to_string()
    };

    let mut cleaned = String::new();
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if (c == '§' || c == '&') && chars.peek().map_or(false, |next| next.is_ascii_alphanumeric()) {
            chars.next();
        } else {
            cleaned.push(c);
        }
    }
    cleaned.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ContentItem {
    pub id: String,
    pub name: String,
    pub file_name: String,
    pub path: String,
    pub size: u64,
    pub enabled: bool,
    #[serde(default)]
    pub is_directory: bool,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "authors", alias = "author", default)]
    pub author: Option<String>,
    #[serde(rename = "iconUrl", alias = "icon", default)]
    pub icon: Option<String>,
    #[serde(rename = "type", alias = "loader", default)]
    pub loader: Option<String>,
    #[serde(rename = "modId", default)]
    pub mod_id: Option<String>,
    #[serde(rename = "projectId", default)]
    pub project_id: Option<String>,
    #[serde(rename = "modrinthId", default)]
    pub modrinth_id: Option<String>,
}

fn extract_mod_metadata(
    file_path: &Path,
) -> (
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
) {
    let default_name = file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown Mod")
        .trim_end_matches(".jar")
        .trim_end_matches(".disabled")
        .to_string();

    let file = match fs::File::open(file_path) {
        Ok(f) => f,
        Err(_) => return (default_name, None, None, None, None, None, None),
    };

    let mut archive = match zip::ZipArchive::new(file) {
        Ok(a) => a,
        Err(_) => return (default_name, None, None, None, None, None, None),
    };

    // Fabric metadata and embedded icon.
    let fabric_metadata = archive
        .by_name("fabric.mod.json")
        .ok()
        .and_then(|mut file| {
        let mut content = String::new();
            file.read_to_string(&mut content).ok()?;
            serde_json::from_str::<serde_json::Value>(&content).ok()
        });
    if let Some(val) = fabric_metadata {
        let name = val
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(&default_name)
            .to_string();
        let version = val
            .get("version")
            .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
        let description = val
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let authors = val.get("authors").and_then(|v| v.as_array()).map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    item.as_str()
                        .or_else(|| item.get("name").and_then(|v| v.as_str()))
                })
                .collect::<Vec<_>>()
                .join(", ")
        });
        let mod_id = val.get("id").and_then(|v| v.as_str()).map(str::to_string);
        let icon = val
            .get("icon")
            .and_then(|v| v.as_str())
            .and_then(|icon_path| {
                let mut icon_entry = archive.by_name(icon_path).ok()?;
                let mut bytes = Vec::new();
                icon_entry.read_to_end(&mut bytes).ok()?;
                Some(format!(
                    "data:image/png;base64,{}",
                    base64::engine::general_purpose::STANDARD.encode(bytes)
                ))
            });

        return (
            name,
            version,
            description,
            authors,
            mod_id,
            Some("fabric".into()),
            icon,
        );
    }

    // Check quilt.mod.json
    let quilt_metadata = archive.by_name("quilt.mod.json").ok().and_then(|mut file| {
        let mut content = String::new();
        file.read_to_string(&mut content).ok()?;
        serde_json::from_str::<serde_json::Value>(&content).ok()
    });
    if let Some(val) = quilt_metadata {
                let metadata = val.get("quilt_loader").and_then(|v| v.get("metadata"));
                let name = metadata
                    .and_then(|m| m.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(&default_name)
                    .to_string();
                let version = metadata
                    .and_then(|m| m.get("version"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let description = metadata
                    .and_then(|m| m.get("description"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

        let mod_id = val
            .get("quilt_loader")
            .and_then(|v| v.get("id"))
            .and_then(|v| v.as_str())
            .map(str::to_string);
        let loader_metadata = val.get("quilt_loader").and_then(|v| v.get("metadata"));
        let authors = loader_metadata
            .and_then(|v| v.get("contributors"))
            .and_then(|v| v.as_object())
            .map(|contributors| contributors.keys().cloned().collect::<Vec<_>>().join(", "));
        let icon = loader_metadata
            .and_then(|v| v.get("icon"))
            .and_then(|v| v.as_str())
            .and_then(|icon_path| {
                let mut icon_entry = archive.by_name(icon_path).ok()?;
                let mut bytes = Vec::new();
                icon_entry.read_to_end(&mut bytes).ok()?;
                Some(format!(
                    "data:image/png;base64,{}",
                    base64::engine::general_purpose::STANDARD.encode(bytes)
                ))
            });
        return (
            name,
            version,
            description,
            authors,
            mod_id,
            Some("quilt".into()),
            icon,
        );
    }

    // Check META-INF/neoforge.mods.toml
    let neoforge_text = archive
        .by_name("META-INF/neoforge.mods.toml")
        .ok()
        .and_then(|mut f| {
            let mut s = String::new();
            f.read_to_string(&mut s).ok().map(|_| s)
        });
    if let Some(text) = neoforge_text {
        let id = extract_toml_field(&text, "modId");
        let name = extract_toml_field(&text, "displayName").unwrap_or_else(|| default_name.clone());
        let version = extract_toml_field(&text, "version");
        let description = extract_toml_field(&text, "description");
        let authors = extract_toml_field(&text, "authors");
        let logo_file = extract_toml_field(&text, "logoFile");
        let mut icon = None;
        if let Some(logo) = logo_file {
            let logo_clean = logo.trim_start_matches('/');
            for cand in [logo_clean.to_string(), format!("META-INF/{}", logo_clean)] {
                if let Ok(mut icon_entry) = archive.by_name(&cand) {
                    let mut bytes = Vec::new();
                    if icon_entry.read_to_end(&mut bytes).is_ok() {
                        icon = Some(format!(
                            "data:image/png;base64,{}",
                            base64::engine::general_purpose::STANDARD.encode(bytes)
                        ));
                        break;
                    }
                }
            }
        }
        return (
            name,
            version,
            description,
            authors,
            id,
            Some("neoforge".into()),
            icon,
        );
    }

    // Check META-INF/mods.toml (Forge)
    let forge_text = archive
        .by_name("META-INF/mods.toml")
        .ok()
        .and_then(|mut f| {
            let mut s = String::new();
            f.read_to_string(&mut s).ok().map(|_| s)
        });
    if let Some(text) = forge_text {
        let id = extract_toml_field(&text, "modId");
        let name = extract_toml_field(&text, "displayName").unwrap_or_else(|| default_name.clone());
        let version = extract_toml_field(&text, "version");
        let description = extract_toml_field(&text, "description");
        let authors = extract_toml_field(&text, "authors");
        let logo_file = extract_toml_field(&text, "logoFile");
        let mut icon = None;
        if let Some(logo) = logo_file {
            let logo_clean = logo.trim_start_matches('/');
            for cand in [logo_clean.to_string(), format!("META-INF/{}", logo_clean)] {
                if let Ok(mut icon_entry) = archive.by_name(&cand) {
                    let mut bytes = Vec::new();
                    if icon_entry.read_to_end(&mut bytes).is_ok() {
                        icon = Some(format!(
                            "data:image/png;base64,{}",
                            base64::engine::general_purpose::STANDARD.encode(bytes)
                        ));
                        break;
                    }
                }
            }
        }
        return (
            name,
            version,
            description,
            authors,
            id,
            Some("forge".into()),
            icon,
        );
    }

    // Check mcmod.info (Forge legacy)
    if let Ok(mut mcmod_file) = archive.by_name("mcmod.info") {
        let mut content = String::new();
        if mcmod_file.read_to_string(&mut content).is_ok() {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                let first = val.as_array().and_then(|a| a.first()).unwrap_or(&val);
                let name = first
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&default_name)
                    .to_string();
                let version = first
                    .get("version")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let description = first
                    .get("description")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let mod_id = first
                    .get("modid")
                    .and_then(|v| v.as_str())
                    .map(str::to_string);
                let authors = first
                    .get("authorList")
                    .and_then(|v| v.as_array())
                    .map(|items| {
                        items
                            .iter()
                            .filter_map(|v| v.as_str())
                            .collect::<Vec<_>>()
                            .join(", ")
                    });
                return (
                    name,
                    version,
                    description,
                    authors,
                    mod_id,
                    Some("forge".into()),
                    None,
                );
            }
        }
    }

    (default_name, None, None, None, None, None, None)
}

fn extract_toml_field(text: &str, field_name: &str) -> Option<String> {
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || !trimmed.contains('=') {
            continue;
        }
        let parts: Vec<&str> = trimmed.splitn(2, '=').collect();
        if parts.len() == 2 && parts[0].trim() == field_name {
            let val = parts[1].trim();
            let val = val.trim_matches(|c| c == '"' || c == '\'');
            if !val.is_empty() {
                return Some(val.to_string());
            }
        }
    }
    None
}

pub fn read_installed_mods(instance_id: Option<&str>) -> Vec<ContentItem> {
    let mods_dir = get_target_game_dir(instance_id).join("mods");
    let _ = fs::create_dir_all(&mods_dir);
    let metadata_store = read_metadata_store();

    let mut items = Vec::new();
    if let Ok(entries) = fs::read_dir(mods_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let name_lower = p
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                let is_jar = name_lower.ends_with(".jar");
                let is_disabled = name_lower.ends_with(".disabled");
                let is_olpkg = name_lower.ends_with(".olpkg");

                if is_jar || is_disabled || is_olpkg {
                    let meta = entry.metadata().ok();
                    let size = meta.map(|m| m.len()).unwrap_or(0);
                    let enabled = !is_disabled;
                    let file_name = p
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();

                    let (mod_name, version, description, author, mod_id, loader, icon) =
                        extract_mod_metadata(&p);

                    let mut base_key = name_lower.as_str();
                    if let Some(s) = base_key.strip_suffix(".disabled") {
                        base_key = s;
                    }
                    if let Some(s) = base_key.strip_suffix(".jar") {
                        base_key = s;
                    }
                    if let Some(s) = base_key.strip_suffix(".olpkg") {
                        base_key = s;
                    }

                    let meta_obj = metadata_store
                        .get(base_key)
                        .or_else(|| metadata_store.get(&name_lower))
                        .or_else(|| metadata_store.get(&file_name));

                    let final_name = if mod_name == file_name
                        || mod_name == base_key
                        || mod_name.starts_with("Unknown")
                    {
                        meta_obj
                            .and_then(|m| m.get("displayName").or_else(|| m.get("title")))
                            .and_then(|v| v.as_str())
                            .filter(|s| !s.trim().is_empty())
                            .map(str::to_string)
                            .unwrap_or(mod_name)
                    } else {
                        mod_name
                    };

                    let final_desc = description.or_else(|| {
                        meta_obj
                            .and_then(|m| m.get("description"))
                            .and_then(|v| v.as_str())
                            .filter(|s| !s.trim().is_empty())
                            .map(|s| clean_minecraft_text(s))
                    });

                    let final_author = author.or_else(|| {
                        meta_obj
                            .and_then(|m| m.get("authors").or_else(|| m.get("author")))
                            .and_then(|v| v.as_str())
                            .filter(|s| !s.trim().is_empty())
                            .map(str::to_string)
                    });

                    let final_icon = icon.or_else(|| {
                        meta_obj
                            .and_then(|m| m.get("iconUrl").or_else(|| m.get("icon")))
                            .and_then(|v| v.as_str())
                            .filter(|s| !s.trim().is_empty())
                            .map(str::to_string)
                    });

                    let final_version = version.or_else(|| {
                        meta_obj
                            .and_then(|m| m.get("version"))
                            .and_then(|v| v.as_str())
                            .filter(|s| !s.trim().is_empty())
                            .map(str::to_string)
                    });

                    let project_id = meta_obj
                        .and_then(|m| m.get("projectId").or_else(|| m.get("project_id")))
                        .and_then(|v| v.as_str())
                        .map(str::to_string);

                    let modrinth_id = meta_obj
                        .and_then(|m| m.get("modrinthId").or_else(|| m.get("slug")))
                        .and_then(|v| v.as_str())
                        .map(str::to_string);

                    items.push(ContentItem {
                        id: file_name.clone(),
                        name: final_name,
                        file_name,
                        path: p.to_string_lossy().to_string(),
                        size,
                        enabled,
                        is_directory: false,
                        version: final_version,
                        description: final_desc,
                        author: final_author,
                        icon: final_icon,
                        loader,
                        mod_id,
                        project_id,
                        modrinth_id,
                    });
                }
            }
        }
    }
    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    items
}

pub fn read_installed_content(folder_name: &str, instance_id: Option<&str>) -> Vec<ContentItem> {
    let dir = get_target_game_dir(instance_id).join(folder_name);
    let _ = fs::create_dir_all(&dir);
    let metadata_store = read_metadata_store();

    let mut items = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            let is_file = p.is_file();
            let is_dir = p.is_dir();

            if is_file || is_dir {
                let file_name = p
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_string();
                if file_name.starts_with('.') {
                    continue;
                }
                let lower_name = file_name.to_lowercase();
                if lower_name == "desktop.ini" || lower_name == "thumbs.db" {
                    continue;
                }
                if is_file && !lower_name.ends_with(".zip") && !lower_name.ends_with(".zip.disabled") {
                    continue;
                }
                let meta = entry.metadata().ok();
                let size = meta.map(|m| m.len()).unwrap_or(0);
                let enabled = !lower_name.ends_with(".disabled");

                let mut stem = file_name.as_str();
                if let Some(s) = stem.strip_suffix(".disabled") {
                    stem = s;
                }
                if let Some(s) = stem.strip_suffix(".zip") {
                    stem = s;
                }
                let clean_name = stem.to_string();

                let mut base_key = lower_name.as_str();
                if let Some(s) = base_key.strip_suffix(".disabled") {
                    base_key = s;
                }
                if let Some(s) = base_key.strip_suffix(".zip") {
                    base_key = s;
                }

                let (extracted_desc, extracted_icon) = extract_pack_metadata(&p, is_dir);

                let meta_obj = metadata_store
                    .get(base_key)
                    .or_else(|| metadata_store.get(&lower_name))
                    .or_else(|| metadata_store.get(&file_name))
                    .or_else(|| metadata_store.get(&format!("{}.zip", base_key)));

                let name = meta_obj
                    .and_then(|m| m.get("displayName").or_else(|| m.get("title")))
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.trim().is_empty())
                    .map(str::to_string)
                    .unwrap_or(clean_name);

                let description = extracted_desc
                    .filter(|s| !s.trim().is_empty())
                    .or_else(|| {
                        meta_obj
                            .and_then(|m| m.get("description"))
                            .and_then(|v| v.as_str())
                            .filter(|s| !s.trim().is_empty())
                            .map(|s| clean_minecraft_text(s))
                    });

                let author = meta_obj
                    .and_then(|m| m.get("authors").or_else(|| m.get("author")))
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.trim().is_empty())
                    .map(str::to_string);

                let icon = extracted_icon.or_else(|| {
                    meta_obj
                        .and_then(|m| m.get("iconUrl").or_else(|| m.get("icon")))
                        .and_then(|v| v.as_str())
                        .filter(|s| !s.trim().is_empty())
                        .map(str::to_string)
                });

                let version = meta_obj
                    .and_then(|m| m.get("version"))
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.trim().is_empty())
                    .map(str::to_string);

                let project_id = meta_obj
                    .and_then(|m| m.get("projectId").or_else(|| m.get("project_id")))
                    .and_then(|v| v.as_str())
                    .map(str::to_string);

                let modrinth_id = meta_obj
                    .and_then(|m| m.get("modrinthId").or_else(|| m.get("slug")))
                    .and_then(|v| v.as_str())
                    .map(str::to_string);

                items.push(ContentItem {
                    id: file_name.clone(),
                    name,
                    file_name,
                    path: p.to_string_lossy().to_string(),
                    size,
                    enabled,
                    is_directory: is_dir,
                    version,
                    description,
                    author,
                    icon,
                    loader: None,
                    mod_id: None,
                    project_id,
                    modrinth_id,
                });
            }
        }
    }
    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    items
}

fn extract_pack_metadata(path: &Path, is_directory: bool) -> (Option<String>, Option<String>) {
    let mut description = None;
    let mut icon = None;

    let candidate_icons = [
        "pack.png",
        "icon.png",
        "preview.png",
        "thumbnail.png",
        "shaders/icon.png",
        "shaders/pack.png",
        "shaders/preview.png",
        "shaders\\icon.png",
        "shaders\\pack.png",
        "shaders\\preview.png",
    ];

    if is_directory {
        if let Ok(text) = fs::read_to_string(path.join("pack.mcmeta")) {
            if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&text) {
                if let Some(desc_val) = meta.get("pack").and_then(|v| v.get("description")) {
                    let desc_str = extract_text_component(desc_val);
                    let cleaned = clean_minecraft_text(&desc_str);
                    if !cleaned.is_empty() {
                        description = Some(cleaned);
                    }
                }
            }
        }
        for candidate in candidate_icons {
            let icon_path = path.join(candidate);
            if let Ok(bytes) = fs::read(icon_path) {
                icon = Some(format!(
                    "data:image/png;base64,{}",
                    base64::engine::general_purpose::STANDARD.encode(bytes)
                ));
                break;
            }
        }
    } else if let Ok(file) = fs::File::open(path) {
        if let Ok(mut archive) = zip::ZipArchive::new(file) {
            if let Ok(mut entry) = archive.by_name("pack.mcmeta") {
                let mut text = String::new();
                if entry.read_to_string(&mut text).is_ok() {
                    if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(desc_val) = meta.get("pack").and_then(|v| v.get("description")) {
                            let desc_str = extract_text_component(desc_val);
                            let cleaned = clean_minecraft_text(&desc_str);
                            if !cleaned.is_empty() {
                                description = Some(cleaned);
                            }
                        }
                    }
                }
            }
            for candidate in candidate_icons {
                if let Ok(mut entry) = archive.by_name(candidate) {
                    let mut bytes = Vec::new();
                    if entry.read_to_end(&mut bytes).is_ok() {
                        icon = Some(format!(
                            "data:image/png;base64,{}",
                            base64::engine::general_purpose::STANDARD.encode(bytes)
                        ));
                        break;
                    }
                }
            }
        }
    }

    (description, icon)
}

pub fn toggle_mod(mod_id: &str, enable: bool, instance_id: Option<&str>) -> Result<(), String> {
    let mods_dir = get_target_game_dir(instance_id).join("mods");
    let current_path = mods_dir.join(mod_id);

    if !current_path.exists() {
        return Err("Mod file not found".to_string());
    }

    let target_name = if enable {
        mod_id.trim_end_matches(".disabled").to_string()
    } else if !mod_id.ends_with(".disabled") {
        format!("{}.disabled", mod_id)
    } else {
        mod_id.to_string()
    };

    let target_path = mods_dir.join(target_name);
    if current_path != target_path {
        fs::rename(current_path, target_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn set_all_mods_enabled(enable: bool, instance_id: Option<&str>) -> Result<(), String> {
    let mods = read_installed_mods(instance_id);
    for m in mods {
        if m.enabled != enable {
            let _ = toggle_mod(&m.file_name, enable, instance_id);
        }
    }
    Ok(())
}

pub fn delete_content_file(
    folder_name: &str,
    file_name: &str,
    instance_id: Option<&str>,
) -> Result<(), String> {
    let target_dir = get_target_game_dir(instance_id).join(folder_name);
    let target = target_dir.join(file_name);
    if target.is_dir() {
        fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
        return Ok(());
    } else if target.is_file() {
        fs::remove_file(&target).map_err(|e| e.to_string())?;
        return Ok(());
    }

    if let Ok(entries) = fs::read_dir(&target_dir) {
        let name_lower = file_name.to_lowercase();
        let name_disabled = format!("{}.disabled", name_lower);
        for entry in entries.flatten() {
            let p = entry.path();
            if let Some(entry_name) = p.file_name().and_then(|s| s.to_str()) {
                let entry_lower = entry_name.to_lowercase();
                if entry_lower == name_lower
                    || entry_lower == name_disabled
                    || entry_lower.trim_end_matches(".disabled") == name_lower.trim_end_matches(".disabled")
                {
                    if p.is_dir() {
                        let _ = fs::remove_dir_all(&p);
                    } else {
                        let _ = fs::remove_file(&p);
                    }
                    return Ok(());
                }
            }
        }
    }

    Ok(())
}

pub fn import_content_file(
    source_path: &str,
    folder_name: &str,
    instance_id: Option<&str>,
) -> Result<ContentItem, String> {
    let src = Path::new(source_path);
    if !src.exists() {
        return Err("Source file does not exist".to_string());
    }

    let file_name = src
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("Invalid file name")?;
    let dest_dir = get_target_game_dir(instance_id).join(folder_name);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    let dest = dest_dir.join(file_name);
    if src.is_dir() {
        crate::services::instances::copy_dir_all(src, &dest).map_err(|e| e.to_string())?;
    } else {
        fs::copy(src, &dest).map_err(|e| e.to_string())?;
    }

    let meta = dest.metadata().ok();
    Ok(ContentItem {
        id: file_name.to_string(),
        name: file_name
            .trim_end_matches(".jar")
            .trim_end_matches(".zip")
            .to_string(),
        file_name: file_name.to_string(),
        path: dest.to_string_lossy().to_string(),
        size: meta.map(|m| m.len()).unwrap_or(0),
        enabled: true,
        is_directory: dest.is_dir(),
        version: None,
        description: None,
        author: None,
        icon: None,
        loader: None,
        mod_id: None,
        project_id: None,
        modrinth_id: None,
    })
}

pub fn open_content_folder(folder_name: &str, instance_id: Option<&str>) -> Result<(), String> {
    let path = get_target_game_dir(instance_id).join(folder_name);
    let _ = fs::create_dir_all(&path);
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
