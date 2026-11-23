use crate::paths::get_launcher_data_dir;
use futures_util::StreamExt;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Emitter};

pub const UPDATE_REPOSITORY: &str = "CesarGarza55/OpenLauncher";
pub const UPDATE_RELEASES_API: &str = "https://api.github.com/repos/CesarGarza55/OpenLauncher/releases/latest";
pub const UPDATE_RELEASES_PAGE: &str = "https://github.com/CesarGarza55/OpenLauncher/releases/latest";

fn get_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("OpenLauncher-Updater")
        .build()
        .unwrap_or_default()
}

pub fn version_to_tuple(version: &str) -> Vec<i32> {
    let val = version.trim().to_lowercase();
    let version_type = if val.contains("alpha") {
        0
    } else if val.contains("beta") {
        1
    } else {
        2
    };

    let digits_part = val
        .chars()
        .skip_while(|c| !c.is_ascii_digit())
        .take_while(|c| c.is_ascii_digit() || *c == '.')
        .collect::<String>();

    let mut parts = vec![version_type];
    for p in digits_part.split('.') {
        if let Ok(num) = p.parse::<i32>() {
            parts.push(num);
        }
    }
    parts
}

pub fn compare_version_tuples(left: &[i32], right: &[i32]) -> std::cmp::Ordering {
    let max_len = left.len().max(right.len());
    for i in 0..max_len {
        let l = *left.get(i).unwrap_or(&0);
        let r = *right.get(i).unwrap_or(&0);
        match l.cmp(&r) {
            std::cmp::Ordering::Equal => continue,
            other => return other,
        }
    }
    std::cmp::Ordering::Equal
}

pub fn pick_update_asset(release: &serde_json::Value) -> Option<serde_json::Value> {
    let assets = release.get("assets").and_then(|v| v.as_array())?;
    if assets.is_empty() {
        return None;
    }

    let mut scored: Vec<(i32, serde_json::Value)> = Vec::new();

    for asset in assets {
        let name = asset
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase();
        if name.contains("source code") {
            continue;
        }

        let mut score = 0;
        #[cfg(target_os = "windows")]
        {
            if name.ends_with(".exe") {
                if name.contains("portable") {
                    score += 80;
                } else {
                    score += 100;
                }
            }
            if name.contains("setup") || name.contains("installer") {
                score += 20;
            }
            if name.ends_with(".zip") {
                score += 90;
            }
            if name.contains("win") {
                score += 5;
            }
        }

        #[cfg(target_os = "linux")]
        {
            if name.ends_with(".appimage") {
                score += 120;
            }
            if name.ends_with(".deb") {
                score += 90;
            }
            if name.ends_with(".tar.gz") || name.ends_with(".tar.xz") {
                score += 80;
            }
            if name.contains("linux") {
                score += 5;
            }
        }

        #[cfg(target_os = "macos")]
        {
            if name.ends_with(".dmg") {
                score += 100;
            }
            if name.ends_with(".zip") {
                score += 80;
            }
            if name.contains("mac") {
                score += 10;
            }
        }

        if score > 0 {
            scored.push((score, asset.clone()));
        }
    }

    scored.sort_by(|a, b| b.0.cmp(&a.0));
    scored.into_iter().next().map(|(_, a)| a)
}

pub fn is_launchable_asset(name: &str) -> bool {
    let lower = name.to_lowercase();
    #[cfg(target_os = "windows")]
    {
        lower.ends_with(".exe")
    }
    #[cfg(target_os = "linux")]
    {
        lower.ends_with(".appimage")
    }
    #[cfg(target_os = "macos")]
    {
        lower.ends_with(".dmg")
    }
}

pub async fn check_for_launcher_update(
    app_handle: &AppHandle,
) -> Result<serde_json::Value, String> {
    let current_version = env!("CARGO_PKG_VERSION");
    let client = get_client();

    let _ = app_handle.emit(
        "minecraft:update-status",
        serde_json::json!({
            "phase": "checking",
            "currentVersion": current_version,
            "message": "Checking for updates..."
        }),
    );

    let res = client
        .get(UPDATE_RELEASES_API)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Failed to check updates: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Update check failed with status: {}", res.status()));
    }

    let release: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse release: {}", e))?;

    let tag_name = release
        .get("tag_name")
        .or_else(|| release.get("name"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim_start_matches(|c| c == 'v' || c == 'V');

    if tag_name.is_empty() {
        return Err("Release metadata did not include a valid version tag.".into());
    }

    let current_tuple = version_to_tuple(&current_version);
    let latest_tuple = version_to_tuple(tag_name);

    if compare_version_tuples(&latest_tuple, &current_tuple) != std::cmp::Ordering::Greater {
        let _ = app_handle.emit(
            "minecraft:update-status",
            serde_json::json!({
                "phase": "up-to-date",
                "currentVersion": current_version,
                "latestVersion": tag_name,
                "message": "Launcher is up to date."
            }),
        );
        return Ok(serde_json::json!({
            "ok": true,
            "upToDate": true,
            "currentVersion": current_version,
            "latestVersion": tag_name,
        }));
    }

    let asset = pick_update_asset(&release);
    let update_info = serde_json::json!({
        "ok": true,
        "available": true,
        "currentVersion": current_version,
        "latestVersion": tag_name,
        "releaseNotes": release.get("body").and_then(|v| v.as_str()).unwrap_or(""),
        "releaseUrl": release.get("html_url").and_then(|v| v.as_str()).unwrap_or(UPDATE_RELEASES_PAGE),
        "asset": asset,
    });

    let _ = app_handle.emit("minecraft:update-available", update_info.clone());
    Ok(update_info)
}

pub async fn download_and_apply_update(
    app_handle: &AppHandle,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let current_version = env!("CARGO_PKG_VERSION");
    let latest_version = payload
        .get("latestVersion")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let asset = payload.get("asset");

    let download_url = asset
        .and_then(|a| a.get("browser_download_url"))
        .and_then(|v| v.as_str());
    let asset_name = asset
        .and_then(|a| a.get("name"))
        .and_then(|v| v.as_str())
        .unwrap_or("update");

    if download_url.is_none() || !is_launchable_asset(asset_name) {
        let release_url = payload
            .get("releaseUrl")
            .and_then(|v| v.as_str())
            .unwrap_or(UPDATE_RELEASES_PAGE);
        let _ = app_handle.emit(
            "minecraft:update-status",
            serde_json::json!({
                "phase": "release-page",
                "currentVersion": current_version,
                "latestVersion": latest_version,
                "message": "Opening release page..."
            }),
        );
        let _ = open::that(release_url);
        return Ok(serde_json::json!({
            "ok": true,
            "available": true,
            "openedReleasePage": true,
            "currentVersion": current_version,
            "latestVersion": latest_version,
        }));
    }

    let download_url = download_url.unwrap();

    let _ = app_handle.emit(
        "minecraft:update-status",
        serde_json::json!({
            "phase": "downloading",
            "currentVersion": current_version,
            "latestVersion": latest_version,
            "assetName": asset_name,
            "message": format!("Downloading update: {}", asset_name)
        }),
    );

    let updates_dir = get_launcher_data_dir().join("updates");
    fs::create_dir_all(&updates_dir).map_err(|e| e.to_string())?;
    let download_path = updates_dir.join(asset_name);
    let _ = fs::remove_file(&download_path);

    let client = get_client();
    let res = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download update: {}", e))?;

    let total_bytes = res.content_length().unwrap_or(0);
    let mut stream = res.bytes_stream();
    let mut file = fs::File::create(&download_path).map_err(|e| e.to_string())?;
    let mut downloaded_bytes: u64 = 0;

    use std::io::Write;
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded_bytes += chunk.len() as u64;

        let percent = if total_bytes > 0 {
            ((downloaded_bytes as f64 / total_bytes as f64) * 100.0) as i64
        } else {
            0
        };

        let _ = app_handle.emit(
            "minecraft:update-progress",
            serde_json::json!({
                "phase": "downloading",
                "loaded": downloaded_bytes,
                "total": total_bytes,
                "percent": percent,
                "currentVersion": current_version,
                "latestVersion": latest_version,
                "assetName": asset_name,
            }),
        );
    }

    let _ = app_handle.emit(
        "minecraft:update-status",
        serde_json::json!({
            "phase": "launching",
            "currentVersion": current_version,
            "latestVersion": latest_version,
            "assetName": asset_name,
            "message": "Launching installer..."
        }),
    );

    launch_downloaded_update(&download_path)?;

    let _ = app_handle.emit(
        "minecraft:update-complete",
        serde_json::json!({
            "phase": "complete",
            "currentVersion": current_version,
            "latestVersion": latest_version,
            "assetName": asset_name,
            "path": download_path.to_string_lossy(),
        }),
    );

    // Give time for events to deliver before exiting app
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(600));
        std::process::exit(0);
    });

    Ok(serde_json::json!({
        "ok": true,
        "available": true,
        "downloaded": true,
        "path": download_path.to_string_lossy(),
        "currentVersion": current_version,
        "latestVersion": latest_version,
    }))
}

fn launch_downloaded_update(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = fs::metadata(path) {
            let mut perms = meta.permissions();
            perms.set_mode(0o755);
            let _ = fs::set_permissions(path, perms);
        }
        std::process::Command::new(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
