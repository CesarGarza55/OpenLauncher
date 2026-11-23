use crate::paths::get_minecraft_root;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

pub const MOJANG_MANIFEST_URL: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
pub const FABRIC_META_URL: &str = "https://meta.fabricmc.net/v2/versions/loader";
pub const QUILT_META_URL: &str = "https://meta.quiltmc.org/v3/versions/loader";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstalledVersionInfo {
    pub id: String,
    #[serde(rename = "type", default = "default_type")]
    pub version_type: String,
    pub inherits_from: Option<String>,
    pub release_time: Option<String>,
}

fn default_type() -> String {
    "custom".to_string()
}

pub fn read_installed_versions() -> Vec<InstalledVersionInfo> {
    let versions_dir = get_minecraft_root().join("versions");
    let mut list = Vec::new();

    if let Ok(entries) = fs::read_dir(versions_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let id = entry.file_name().to_string_lossy().to_string();
                let json_path = entry.path().join(format!("{}.json", id));
                if json_path.is_file() {
                    if let Ok(content) = fs::read_to_string(&json_path) {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                            let version_type = val.get("type").and_then(|v| v.as_str()).unwrap_or("custom").to_string();
                            let inherits_from = val.get("inheritsFrom").and_then(|v| v.as_str()).map(|s| s.to_string());
                            let release_time = val.get("releaseTime").and_then(|v| v.as_str()).map(|s| s.to_string());

                            list.push(InstalledVersionInfo {
                                id,
                                version_type,
                                inherits_from,
                                release_time,
                            });
                        }
                    }
                }
            }
        }
    }
    list
}

#[derive(Serialize, Clone)]
pub struct ProgressPayload {
    pub install_id: String,
    pub file: String,
    pub loaded: u64,
    pub total: Option<u64>,
    pub percent: Option<u32>,
}

pub async fn download_file(
    client: &reqwest::Client,
    url: &str,
    out_path: &Path,
    file_label: &str,
    install_id: &str,
    app_handle: &AppHandle,
) -> Result<(), String> {
    if let Some(parent) = out_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Download failed for {}: HTTP {}", url, res.status()));
    }

    let total = res.content_length();
    let mut file = fs::File::create(out_path).map_err(|e| e.to_string())?;
    let mut stream = res.bytes_stream();
    let mut loaded: u64 = 0;

    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| e.to_string())?;
        use std::io::Write;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        loaded += chunk.len() as u64;

        let percent = total.map(|t| if t > 0 { ((loaded as f64 / t as f64) * 100.0) as u32 } else { 0 });
        let payload = ProgressPayload {
            install_id: install_id.to_string(),
            file: file_label.to_string(),
            loaded,
            total,
            percent,
        };
        let _ = app_handle.emit("minecraft:install-progress", &payload);
        let _ = app_handle.emit("minecraft:install-file-progress", &payload);
    }

    Ok(())
}

fn check_library_rules(lib: &serde_json::Value) -> bool {
    let rules = match lib.get("rules").and_then(|r| r.as_array()) {
        Some(r) => r,
        None => return true,
    };

    let mut allowed = false;
    let current_os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    };

    for rule in rules {
        let action = rule.get("action").and_then(|a| a.as_str()).unwrap_or("allow");
        let os_match = match rule.get("os").and_then(|o| o.get("name")).and_then(|n| n.as_str()) {
            Some(os) => os == current_os,
            None => true,
        };

        if os_match {
            allowed = action == "allow";
        }
    }

    allowed
}

pub fn get_library_path_from_name(name: &str) -> Option<PathBuf> {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let domain = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    let classifier = if parts.len() > 3 { format!("-{}", parts[3]) } else { "".to_string() };

    let file_name = format!("{}-{}{}.jar", artifact, version, classifier);
    Some(PathBuf::from(domain).join(artifact).join(version).join(file_name))
}

pub async fn install_minecraft(
    version_id: &str,
    loader: Option<&str>,
    mc_ver: Option<&str>,
    install_id: &str,
    app_handle: &AppHandle,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mc_root = get_minecraft_root();
    let final_mc_ver = mc_ver.unwrap_or(version_id);

    let _ = app_handle.emit("minecraft:run-log", serde_json::json!({
        "type": "info",
        "msg": format!("Starting installation of Minecraft {}...", final_mc_ver)
    }));

    // 1. Fetch Mojang manifest
    let manifest: serde_json::Value = client.get(MOJANG_MANIFEST_URL)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let versions = manifest.get("versions").and_then(|v| v.as_array()).ok_or("Invalid manifest")?;
    let target = versions.iter().find(|v| v.get("id").and_then(|i| i.as_str()) == Some(final_mc_ver))
        .ok_or(format!("Version {} not found in Mojang manifest", final_mc_ver))?;

    let version_url = target.get("url").and_then(|u| u.as_str()).ok_or("No URL for version")?;

    // 2. Download Mojang version JSON
    let base_version_dir = mc_root.join("versions").join(final_mc_ver);
    let base_version_json_path = base_version_dir.join(format!("{}.json", final_mc_ver));
    let version_json: serde_json::Value = client.get(version_url)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    fs::create_dir_all(&base_version_dir).map_err(|e| e.to_string())?;
    fs::write(&base_version_json_path, serde_json::to_string_pretty(&version_json).unwrap()).map_err(|e| e.to_string())?;

    // 3. Download Client JAR
    if let Some(client_download) = version_json.get("downloads").and_then(|d| d.get("client")) {
        if let Some(url) = client_download.get("url").and_then(|u| u.as_str()) {
            let client_jar_path = base_version_dir.join(format!("{}.jar", final_mc_ver));
            if !client_jar_path.exists() {
                download_file(&client, url, &client_jar_path, &format!("{}.jar", final_mc_ver), install_id, app_handle).await?;
            }
        }
    }

    // 4. Download Vanilla Libraries
    if let Some(libraries) = version_json.get("libraries").and_then(|l| l.as_array()) {
        for lib in libraries {
            if !check_library_rules(lib) {
                continue;
            }
            if let Some(artifact) = lib.get("downloads").and_then(|d| d.get("artifact")) {
                if let (Some(url), Some(path_str)) = (artifact.get("url").and_then(|u| u.as_str()), artifact.get("path").and_then(|p| p.as_str())) {
                    let dest = mc_root.join("libraries").join(path_str);
                    if !dest.exists() {
                        let name = Path::new(path_str).file_name().and_then(|n| n.to_str()).unwrap_or("library");
                        let _ = download_file(&client, url, &dest, name, install_id, app_handle).await;
                    }
                }
            }
        }
    }

    // 5. Download Asset Index and Assets
    if let Some(asset_index) = version_json.get("assetIndex") {
        if let (Some(url), Some(id)) = (asset_index.get("url").and_then(|u| u.as_str()), asset_index.get("id").and_then(|i| i.as_str())) {
            let index_path = mc_root.join("assets").join("indexes").join(format!("{}.json", id));
            if !index_path.exists() {
                let _ = download_file(&client, url, &index_path, &format!("{}.json", id), install_id, app_handle).await;
            }
        }
    }

    // 6. Handle Mod Loader (Fabric / Quilt)
    let selected_loader = loader.unwrap_or("vanilla").to_lowercase();
    let installed_id = if selected_loader == "fabric" {
        let fabric_profile_url = format!("{}/{}/profile/json", FABRIC_META_URL, final_mc_ver);
        let res = client.get(&fabric_profile_url).send().await.map_err(|e| e.to_string())?;
        if res.status().is_success() {
            let fabric_json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            if let Some(fabric_id) = fabric_json.get("id").and_then(|i| i.as_str()) {
                let fabric_dir = mc_root.join("versions").join(fabric_id);
                fs::create_dir_all(&fabric_dir).map_err(|e| e.to_string())?;
                fs::write(fabric_dir.join(format!("{}.json", fabric_id)), serde_json::to_string_pretty(&fabric_json).unwrap()).map_err(|e| e.to_string())?;

                // Download Fabric libraries
                if let Some(libs) = fabric_json.get("libraries").and_then(|l| l.as_array()) {
                    for lib in libs {
                        if let (Some(url_base), Some(name)) = (lib.get("url").and_then(|u| u.as_str()), lib.get("name").and_then(|n| n.as_str())) {
                            if let Some(rel_path) = get_library_path_from_name(name) {
                                let full_url = format!("{}{}", url_base, rel_path.to_string_lossy().replace('\\', "/"));
                                let dest = mc_root.join("libraries").join(&rel_path);
                                if !dest.exists() {
                                    let fname = rel_path.file_name().and_then(|f| f.to_str()).unwrap_or("library");
                                    let _ = download_file(&client, &full_url, &dest, fname, install_id, app_handle).await;
                                }
                            }
                        }
                    }
                }
                fabric_id.to_string()
            } else {
                final_mc_ver.to_string()
            }
        } else {
            final_mc_ver.to_string()
        }
    } else {
        final_mc_ver.to_string()
    };

    let _ = app_handle.emit("minecraft:install-complete", serde_json::json!({
        "installId": install_id,
        "versionId": installed_id
    }));

    let _ = app_handle.emit("minecraft:run-log", serde_json::json!({
        "type": "info",
        "msg": format!("Installation of {} completed successfully!", installed_id)
    }));

    Ok(installed_id)
}
