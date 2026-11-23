use crate::paths::{get_minecraft_root, get_target_game_dir};
use crate::services::installer::get_library_path_from_name;
use crate::services::java::{detect_java_major, find_compatible_java, resolve_java_command};
use crate::state::AppState;
use futures_util::stream::{self, StreamExt};
use sha1::Digest;
use std::fs;
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};

async fn download_asset(
    client: reqwest::Client,
    hash: String,
    target: std::path::PathBuf,
) -> Result<(), String> {
    let url = format!(
        "https://resources.download.minecraft.net/{}/{}",
        &hash[..2],
        hash
    );
    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "Asset download failed for {}: HTTP {}",
            hash,
            response.status()
        ));
    }
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    if format!("{:x}", sha1::Sha1::digest(&bytes)) != hash {
        return Err(format!("Asset {} failed SHA-1 verification", hash));
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(target, bytes).map_err(|e| e.to_string())
}

async fn prepare_assets(
    version_json: &serde_json::Value,
    mc_root: &Path,
    app_handle: &AppHandle,
) -> Result<(), String> {
    let Some(index) = version_json.get("assetIndex") else {
        return Ok(());
    };
    let index_id = index
        .get("id")
        .and_then(|v| v.as_str())
        .or_else(|| version_json.get("assets").and_then(|v| v.as_str()))
        .unwrap_or("legacy");
    let assets_dir = mc_root.join("assets");
    let indexes_dir = assets_dir.join("indexes");
    let index_path = indexes_dir.join(format!("{}.json", index_id));
    let index_json = if let Ok(content) = fs::read_to_string(&index_path) {
        serde_json::from_str::<serde_json::Value>(&content).ok()
    } else {
        None
    };
    let index_json = if let Some(cached) = index_json {
        cached
    } else {
        let url = index
            .get("url")
            .and_then(|v| v.as_str())
            .ok_or("Version metadata has no asset index URL")?;
        let response = reqwest::Client::new()
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Could not fetch asset index: {}", e))?;
        if !response.status().is_success() {
            return Err(format!(
                "Asset index download failed: HTTP {}",
                response.status()
            ));
        }
        let bytes = response.bytes().await.map_err(|e| e.to_string())?;
        let parsed: serde_json::Value =
            serde_json::from_slice(&bytes).map_err(|e| format!("Invalid asset index: {}", e))?;
        fs::create_dir_all(&indexes_dir).map_err(|e| e.to_string())?;
        fs::write(&index_path, bytes).map_err(|e| e.to_string())?;
        parsed
    };
    let objects = index_json
        .get("objects")
        .and_then(|v| v.as_object())
        .ok_or("Asset index does not contain an objects map")?;
    let mut missing = Vec::new();
    for object in objects.values() {
        let Some(hash) = object.get("hash").and_then(|v| v.as_str()) else {
            continue;
        };
        if hash.len() != 40 {
            continue;
        }
        let path = assets_dir.join("objects").join(&hash[..2]).join(hash);
        let valid = fs::read(&path)
            .ok()
            .map(|bytes| format!("{:x}", sha1::Sha1::digest(bytes)) == hash)
            .unwrap_or(false);
        if !valid {
            missing.push((hash.to_string(), path));
        }
    }
    if !missing.is_empty() {
        let _ = app_handle.emit("minecraft:run-log", serde_json::json!({"type":"info","msg":format!("Downloading {} game assets...", missing.len())}));
        let client = reqwest::Client::new();
        let results: Vec<Result<(), String>> = stream::iter(
            missing
                .into_iter()
                .map(|(hash, path)| download_asset(client.clone(), hash, path)),
        )
        .buffer_unordered(16)
        .collect()
        .await;
        let failures: Vec<String> = results.into_iter().filter_map(Result::err).collect();
        if !failures.is_empty() {
            return Err(format!(
                "{} game assets could not be downloaded. First error: {}",
                failures.len(),
                failures[0]
            ));
        }
    }
    if index_json.get("virtual").and_then(|v| v.as_bool()) == Some(true) {
        let virtual_dir = assets_dir.join("virtual").join(index_id);
        for (name, object) in objects {
            if let (Some(hash), Some(logical_path)) = (
                object.get("hash").and_then(|v| v.as_str()),
                name.split('/').last(),
            ) {
                let mut target = virtual_dir.clone();
                for part in name.split('/') {
                    target.push(part);
                }
                let source = assets_dir.join("objects").join(&hash[..2]).join(hash);
                if !target.exists() {
                    if let Some(parent) = target.parent() {
                        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                    }
                    fs::copy(source, target).map_err(|e| {
                        format!("Could not map virtual asset {}: {}", logical_path, e)
                    })?;
                }
            }
        }
    }
    let _ = app_handle.emit(
        "minecraft:run-log",
        serde_json::json!({"type":"info","msg":"Game assets ready."}),
    );
    Ok(())
}

fn make_offline_uuid(name: &str) -> String {
    use sha1::Digest;
    let mut hasher = sha1::Sha1::new();
    hasher.update(format!("OfflinePlayer:{}", name).as_bytes());
    let hash = format!("{:x}", hasher.finalize());
    format!(
        "{}-{}-{}-{}-{}",
        &hash[0..8],
        &hash[8..12],
        &hash[12..16],
        &hash[16..20],
        &hash[20..32]
    )
}

fn resolve_minecraft_version_str(val: Option<&serde_json::Value>) -> String {
    let v = match val {
        Some(v) => v,
        None => return "".to_string(),
    };

    if let Some(s) = v.as_str() {
        return s.trim().to_string();
    }

    if let Some(obj) = v.as_object() {
        if let Some(id) = obj.get("id").and_then(|i| i.as_str()) {
            return id.trim().to_string();
        }
        if let Some(inherits) = obj.get("inheritsFrom").and_then(|i| i.as_str()) {
            return inherits.trim().to_string();
        }
        if let Some(mc_ver) = obj.get("mcVer").and_then(|m| m.as_str()) {
            return mc_ver.trim().to_string();
        }
        if let Some(base_ver) = obj.get("baseVersion").and_then(|b| b.as_str()) {
            return base_ver.trim().to_string();
        }
    }

    "".to_string()
}

fn build_classpath(
    version_json: &serde_json::Value,
    mc_root: &Path,
    client_jar_path: &Path,
) -> String {
    let mut cp_entries = Vec::new();

    if let Some(libraries) = version_json.get("libraries").and_then(|l| l.as_array()) {
        for lib in libraries {
            if !library_rules_match(lib.get("rules")) {
                continue;
            }
            if let Some(artifact_path) = lib
                .get("downloads")
                .and_then(|d| d.get("artifact"))
                .and_then(|a| a.get("path"))
                .and_then(|p| p.as_str())
            {
                let full = mc_root.join("libraries").join(artifact_path);
                if full.is_file() {
                    cp_entries.push(full.to_string_lossy().to_string());
                    continue;
                }
            }

            if let Some(name) = lib.get("name").and_then(|n| n.as_str()) {
                if let Some(rel) = get_library_path_from_name(name) {
                    let full = mc_root.join("libraries").join(rel);
                    if full.is_file() {
                        cp_entries.push(full.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    if client_jar_path.is_file() {
        cp_entries.push(client_jar_path.to_string_lossy().to_string());
    }

    let separator = if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    };
    cp_entries.join(separator)
}

fn library_rules_match(rules: Option<&serde_json::Value>) -> bool {
    let Some(rules) = rules.and_then(|r| r.as_array()) else {
        return true;
    };
    let mut allowed = !rules
        .iter()
        .any(|r| r.get("action").and_then(|a| a.as_str()) == Some("allow"));
    for rule in rules {
        let os_match = match rule
            .get("os")
            .and_then(|o| o.get("name"))
            .and_then(|n| n.as_str())
        {
            Some("windows") => cfg!(target_os = "windows"),
            Some("osx") => cfg!(target_os = "macos"),
            Some("linux") => cfg!(target_os = "linux"),
            Some(_) => false,
            None => true,
        };
        if os_match {
            allowed = rule.get("action").and_then(|a| a.as_str()) == Some("allow");
        }
    }
    allowed
}

fn version_arg_rules_match(
    rules: Option<&serde_json::Value>,
    features: Option<&serde_json::Value>,
) -> bool {
    let Some(rules) = rules.and_then(|value| value.as_array()) else {
        return true;
    };
    let mut allowed = !rules
        .iter()
        .any(|rule| rule.get("action").and_then(|value| value.as_str()) == Some("allow"));

    for rule in rules {
        let os_match = match rule
            .get("os")
            .and_then(|os| os.get("name"))
            .and_then(|name| name.as_str())
        {
            Some("windows") => cfg!(target_os = "windows"),
            Some("osx") => cfg!(target_os = "macos"),
            Some("linux") => cfg!(target_os = "linux"),
            Some(_) => false,
            None => true,
        };
        let features_match = rule
            .get("features")
            .and_then(|value| value.as_object())
            .map(|required| {
                required.iter().all(|(name, expected)| {
                    let actual = features
                        .and_then(|value| value.get(name))
                        .and_then(|value| value.as_bool())
                        .unwrap_or(false);
                    expected.as_bool().unwrap_or(false) == actual
                })
            })
            .unwrap_or(true);

        if os_match && features_match {
            allowed = rule.get("action").and_then(|value| value.as_str()) == Some("allow");
        }
    }
    allowed
}

fn append_version_args(
    cmd: &mut tokio::process::Command,
    args: Option<&serde_json::Value>,
    replacements: &[(String, String)],
    features: Option<&serde_json::Value>,
) {
    let Some(args) = args.and_then(|a| a.as_array()) else {
        return;
    };
    let mut skip_classpath_value = false;
    for arg in args {
        let values: Vec<&str> = if let Some(s) = arg.as_str() {
            vec![s]
        } else if let Some(obj) = arg.as_object() {
            if !version_arg_rules_match(obj.get("rules"), features) {
                continue;
            }
            match obj.get("value") {
                Some(serde_json::Value::String(s)) => vec![s],
                Some(serde_json::Value::Array(a)) => a.iter().filter_map(|v| v.as_str()).collect(),
                _ => continue,
            }
        } else {
            continue;
        };
        for value in values {
            if skip_classpath_value {
                skip_classpath_value = false;
                continue;
            }
            if value == "-cp" || value == "-classpath" {
                skip_classpath_value = true;
                continue;
            }
            let expanded = replacements
                .iter()
                .fold(value.to_string(), |s, (key, val)| s.replace(key, val));
            cmd.arg(expanded);
        }
    }
}

fn merge_inherited_version_metadata(
    version_json: &mut serde_json::Value,
    base_json: &serde_json::Value,
) {
    let base_libraries = base_json
        .get("libraries")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    let custom_libraries = version_json
        .get("libraries")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    if !base_libraries.is_empty() || !custom_libraries.is_empty() {
        version_json["libraries"] =
            serde_json::Value::Array(base_libraries.into_iter().chain(custom_libraries).collect());
    }

    let mut merged_arguments = serde_json::Map::new();
    for key in ["game", "jvm"] {
        let collect = |value: Option<&serde_json::Value>| -> Vec<serde_json::Value> {
            match value {
                Some(serde_json::Value::Array(values)) => values.clone(),
                Some(serde_json::Value::Null) | None => Vec::new(),
                Some(value) => vec![value.clone()],
            }
        };
        let base_args = collect(base_json.get("arguments").and_then(|args| args.get(key)));
        let custom_args = collect(version_json.get("arguments").and_then(|args| args.get(key)));
        if !base_args.is_empty() || !custom_args.is_empty() {
            merged_arguments.insert(
                key.to_string(),
                serde_json::Value::Array(base_args.into_iter().chain(custom_args).collect()),
            );
        }
    }
    if !merged_arguments.is_empty() {
        version_json["arguments"] = serde_json::Value::Object(merged_arguments);
    }

    for key in [
        "assetIndex",
        "assets",
        "downloads",
        "javaVersion",
        "mainClass",
        "minecraftArguments",
        "type",
    ] {
        if version_json.get(key).is_none() {
            if let Some(value) = base_json.get(key) {
                version_json[key] = value.clone();
            }
        }
    }
}

pub async fn launch_minecraft(
    opts: serde_json::Value,
    app_handle: AppHandle,
    state: Arc<AppState>,
) -> Result<u32, String> {
    let mc_root = get_minecraft_root();
    let profile = opts.get("profile");

    // 1. Resolve version string
    let mut version_str = resolve_minecraft_version_str(opts.get("version"));
    if version_str.is_empty() {
        version_str = resolve_minecraft_version_str(profile.and_then(|p| p.get("version")));
    }
    if version_str.is_empty() {
        return Err("No Minecraft version specified".to_string());
    }

    let instance_id = opts.get("instanceId").and_then(|v| v.as_str());
    let game_dir = get_target_game_dir(instance_id);
    let _ = fs::create_dir_all(&game_dir);

    // 2. Resolve Java command after reading version metadata, which declares its minimum runtime.
    let custom_java = opts
        .get("javaPath")
        .or_else(|| profile.and_then(|p| p.get("javaPath")))
        .and_then(|v| v.as_str());

    let java_cmd_preference = custom_java.map(str::to_owned);

    // 3. Find version JSON
    let version_dir = mc_root.join("versions").join(&version_str);
    let mut version_json_path = version_dir.join(format!("{}.json", version_str));

    if !version_json_path.exists() {
        // Fallback: check if version has inheritsFrom or is in subfolder
        if let Some(inherits) = opts
            .get("version")
            .and_then(|v| v.get("inheritsFrom"))
            .and_then(|i| i.as_str())
        {
            let alt_dir = mc_root.join("versions").join(inherits);
            let alt_json = alt_dir.join(format!("{}.json", inherits));
            if alt_json.exists() {
                version_json_path = alt_json;
            }
        }
    }

    if !version_json_path.exists() {
        return Err(format!(
            "Version '{}' is not installed. Please install it first.",
            version_str
        ));
    }

    let raw_json = fs::read_to_string(&version_json_path).map_err(|e| e.to_string())?;
    let mut version_json: serde_json::Value =
        serde_json::from_str(&raw_json).map_err(|e| e.to_string())?;

    let required_java = version_json
        .get("javaVersion")
        .and_then(|v| v.get("majorVersion"))
        .and_then(|v| v.as_u64())
        .map(|v| v as u32)
        .unwrap_or(8);
    let settings_java = fs::read_to_string(crate::paths::get_launcher_state_path())
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|s| {
            s.get("settings")
                .and_then(|v| v.get("javaPath"))
                .and_then(|v| v.as_str())
                .map(str::to_owned)
        });
    let preferred_java = java_cmd_preference
        .filter(|p| !p.trim().is_empty())
        .or(settings_java.filter(|p| !p.trim().is_empty()));
    let mut java_cmd = resolve_java_command(preferred_java.as_deref());
    let mut java_major = detect_java_major(&java_cmd);
    if java_major
        .map(|major| major < required_java)
        .unwrap_or(true)
    {
        if let Some((compatible, major)) = find_compatible_java(required_java) {
            java_cmd = compatible;
            java_major = Some(major);
        } else {
            return Err(format!(
                "Minecraft {} requires Java {} or newer, but '{}' is Java {}. Install Java {} or configure its path in Settings.",
                version_str,
                required_java,
                java_cmd,
                java_major
                    .map(|m| m.to_string())
                    .unwrap_or_else(|| "unknown".into()),
                required_java
            ));
        }
    }
    let mut java_major = java_major.unwrap_or(required_java);
    let _ = app_handle.emit("minecraft:run-log", serde_json::json!({"type":"info","msg":format!("Using Java: {} (Detected Major: {})", java_cmd, java_major)}));

    // Handle inheritance (e.g. Fabric inherits from Vanilla)
    let mut base_version = version_str.clone();
    if let Some(inherits) = version_json.get("inheritsFrom").and_then(|i| i.as_str()) {
        base_version = inherits.to_string();
        let base_json_path = mc_root
            .join("versions")
            .join(inherits)
            .join(format!("{}.json", inherits));
        if let Ok(base_raw) = fs::read_to_string(&base_json_path) {
            if let Ok(base_json) = serde_json::from_str::<serde_json::Value>(&base_raw) {
                merge_inherited_version_metadata(&mut version_json, &base_json);
            }
        }
    }

    // Loader metadata can omit javaVersion; use the inherited vanilla requirement too.
    let required_java = version_json
        .get("javaVersion")
        .and_then(|v| v.get("majorVersion"))
        .and_then(|v| v.as_u64())
        .map(|v| v as u32)
        .unwrap_or(8);
    if java_major < required_java {
        if let Some((compatible, major)) = find_compatible_java(required_java) {
            java_cmd = compatible;
            java_major = major;
            let _ = app_handle.emit("minecraft:run-log", serde_json::json!({"type":"info","msg":format!("Using compatible Java: {} (Detected Major: {})", java_cmd, major)}));
        } else {
            return Err(format!(
                "Minecraft {} requires Java {} or newer. Install Java {} or configure its path in Settings.",
                version_str, required_java, required_java
            ));
        }
    }

    prepare_assets(&version_json, &mc_root, &app_handle).await?;

    let client_jar_path = mc_root
        .join("versions")
        .join(&base_version)
        .join(format!("{}.jar", base_version));
    let classpath = build_classpath(&version_json, &mc_root, &client_jar_path);

    let main_class = version_json
        .get("mainClass")
        .and_then(|m| m.as_str())
        .unwrap_or("net.minecraft.client.main.Main");

    // 4. Resolve session / auth
    let session = opts
        .get("session")
        .or_else(|| opts.get("auth"))
        .or_else(|| profile.and_then(|p| p.get("session")));
    let auth_name = session
        .and_then(|s| s.get("name").or_else(|| s.get("username")))
        .or_else(|| profile.and_then(|p| p.get("localName").or_else(|| p.get("name"))))
        .and_then(|v| v.as_str())
        .unwrap_or("Player")
        .to_string();

    let auth_uuid = session
        .and_then(|s| s.get("uuid").or_else(|| s.get("id")))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| make_offline_uuid(&auth_name));

    let auth_token = session
        .and_then(|s| {
            s.get("accessToken")
                .or_else(|| s.get("access_token"))
                .or_else(|| s.get("token"))
        })
        .and_then(|v| v.as_str())
        .unwrap_or("0")
        .to_string();

    let user_type = session
        .and_then(|s| s.get("userType").or_else(|| s.get("user_type")))
        .and_then(|v| v.as_str())
        .unwrap_or(if auth_token != "0" { "msa" } else { "mojang" })
        .to_string();

    let asset_index_id = version_json
        .get("assetIndex")
        .and_then(|a| a.get("id"))
        .or_else(|| version_json.get("assets"))
        .and_then(|i| i.as_str())
        .unwrap_or("legacy");

    // 5. Memory and JVM args
    let ram = opts
        .get("ram")
        .or_else(|| profile.and_then(|p| p.get("ram")))
        .and_then(|v| v.as_u64())
        .unwrap_or(4) as u32;

    let mut cmd = tokio::process::Command::new(&java_cmd);

    cmd.arg(format!("-Xms{}G", (ram / 2).max(1)));
    cmd.arg(format!("-Xmx{}G", ram));

    if java_major >= 21 {
        // Newer Java releases may remove experimental ZGC flags; match the Electron
        // runner and let the JVM ignore those flags instead of aborting startup.
        cmd.arg("-XX:+IgnoreUnrecognizedVMOptions");
        cmd.arg("-XX:+UnlockExperimentalVMOptions");
        cmd.arg("-XX:+UseZGC");
        cmd.arg("-XX:+ZGenerational");
    } else {
        cmd.arg("-XX:+IgnoreUnrecognizedVMOptions");
        cmd.arg("-XX:+UnlockExperimentalVMOptions");
        cmd.arg("-XX:+UseG1GC");
        cmd.arg("-XX:MaxGCPauseMillis=200");
    }

    let natives_dir = mc_root.join("versions").join(&version_str).join("natives");
    let _ = fs::create_dir_all(&natives_dir);
    cmd.arg(format!(
        "-Djava.library.path={}",
        natives_dir.to_string_lossy()
    ));

    let extra_jvm = opts
        .get("jvmArgs")
        .or_else(|| profile.and_then(|p| p.get("jvmArguments")))
        .or_else(|| profile.and_then(|p| p.get("jvmArgs")))
        .and_then(|v| v.as_str());

    if let Some(extra) = extra_jvm {
        for arg in extra.split_whitespace() {
            cmd.arg(arg);
        }
    }

    let jvm_replacements = vec![
        (
            "${natives_directory}".to_string(),
            natives_dir.to_string_lossy().to_string(),
        ),
        ("${launcher_name}".to_string(), "OpenLauncher".to_string()),
        ("${launcher_version}".to_string(), env!("CARGO_PKG_VERSION").to_string()),
        ("${classpath}".to_string(), classpath.clone()),
        (
            "${classpath_separator}".to_string(),
            if cfg!(target_os = "windows") {
                ";"
            } else {
                ":"
            }
            .to_string(),
        ),
        (
            "${library_directory}".to_string(),
            mc_root.join("libraries").to_string_lossy().to_string(),
        ),
    ];
    append_version_args(
        &mut cmd,
        version_json.get("arguments").and_then(|a| a.get("jvm")),
        &jvm_replacements,
        opts.get("features"),
    );
    cmd.arg(format!(
        "-DlibraryDirectory={}",
        mc_root.join("libraries").to_string_lossy()
    ));
    cmd.arg("-cp").arg(&classpath).arg(main_class);

    // 6. Game arguments
    let replace_vars = |s: &str| -> String {
        s.replace("${auth_player_name}", &auth_name)
            .replace("${version_name}", &version_str)
            .replace("${game_directory}", &game_dir.to_string_lossy())
            .replace("${assets_root}", &mc_root.join("assets").to_string_lossy())
            .replace("${assets_index_name}", asset_index_id)
            .replace("${auth_uuid}", &auth_uuid)
            .replace("${auth_access_token}", &auth_token)
            .replace("${auth_session}", &auth_token)
            .replace("${user_type}", &user_type)
            .replace("${version_type}", "release")
            .replace("${user_properties}", "{}")
    };

    let game_replacements = vec![
        ("${auth_player_name}".to_string(), auth_name.clone()),
        ("${version_name}".to_string(), version_str.clone()),
        (
            "${game_directory}".to_string(),
            game_dir.to_string_lossy().to_string(),
        ),
        (
            "${assets_root}".to_string(),
            mc_root.join("assets").to_string_lossy().to_string(),
        ),
        (
            "${assets_index_name}".to_string(),
            asset_index_id.to_string(),
        ),
        ("${auth_uuid}".to_string(), auth_uuid.clone()),
        ("${auth_access_token}".to_string(), auth_token.clone()),
        ("${auth_session}".to_string(), auth_token.clone()),
        ("${user_type}".to_string(), user_type.clone()),
        ("${version_type}".to_string(), "release".to_string()),
        ("${user_properties}".to_string(), "{}".to_string()),
    ];
    if version_json
        .get("arguments")
        .and_then(|a| a.get("game"))
        .is_some()
    {
        append_version_args(
            &mut cmd,
            version_json.get("arguments").and_then(|a| a.get("game")),
            &game_replacements,
            opts.get("features"),
        );
    } else if let Some(legacy_args) = version_json
        .get("minecraftArguments")
        .and_then(|m| m.as_str())
    {
        for token in legacy_args.split_whitespace() {
            cmd.arg(replace_vars(token));
        }
    } else {
        cmd.arg("--username").arg(&auth_name);
        cmd.arg("--version").arg(&version_str);
        cmd.arg("--gameDir")
            .arg(game_dir.to_string_lossy().to_string());
        cmd.arg("--assetsDir")
            .arg(mc_root.join("assets").to_string_lossy().to_string());
        cmd.arg("--assetIndex").arg(asset_index_id);
        cmd.arg("--uuid").arg(&auth_uuid);
        cmd.arg("--accessToken").arg(&auth_token);
        cmd.arg("--userType").arg(&user_type);
        cmd.arg("--versionType").arg("release");
    }

    // Keep the process working directory at the shared Minecraft root, matching
    // the Electron launcher. The instance remains isolated through --gameDir;
    // shared runtime assets and libraries are rooted at mc_root.
    cmd.current_dir(&mc_root);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let _ = app_handle.emit("minecraft:run-log", serde_json::json!({
        "type": "info",
        "msg": format!("Launching Minecraft {} from {}...", version_str, game_dir.to_string_lossy())
    }));

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start Minecraft process: {}", e))?;
    let pid = child.id().ok_or("Failed to get process ID")?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let (kill_tx, mut kill_rx) = tokio::sync::oneshot::channel::<()>();
    {
        let mut procs = state.running_processes.lock().await;
        procs.insert(pid, kill_tx);
    }

    let app_handle_clone = app_handle.clone();
    if let Some(out) = stdout {
        tokio::spawn(async move {
            let mut reader = BufReader::new(out).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_handle_clone.emit(
                    "minecraft:run-log",
                    serde_json::json!({
                        "type": "stdout",
                        "msg": line
                    }),
                );
            }
        });
    }

    let app_handle_clone2 = app_handle.clone();
    if let Some(err) = stderr {
        tokio::spawn(async move {
            let mut reader = BufReader::new(err).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_handle_clone2.emit(
                    "minecraft:run-log",
                    serde_json::json!({
                        "type": "stderr",
                        "msg": line
                    }),
                );
            }
        });
    }

    let state_clone = state.clone();
    let app_handle_clone3 = app_handle.clone();
    tokio::spawn(async move {
        tokio::select! {
            res = child.wait() => {
                let exit_code = match res {
                    Ok(status) => status.code().unwrap_or(0),
                    Err(_) => -1,
                };
                let _ = app_handle_clone3.emit("minecraft:run-exit", serde_json::json!({
                    "code": exit_code,
                    "signal": null,
                    "error": if exit_code != 0 { Some("Minecraft exited with error") } else { None }
                }));
            }
            _ = &mut kill_rx => {
                let _ = child.kill().await;
                let _ = app_handle_clone3.emit("minecraft:run-exit", serde_json::json!({
                    "code": -1,
                    "signal": "SIGTERM",
                    "error": Some("Terminated by user")
                }));
            }
        }
        let mut procs = state_clone.running_processes.lock().await;
        procs.remove(&pid);
    });

    Ok(pid)
}

pub async fn stop_minecraft(pid: u32, state: Arc<AppState>) -> Result<(), String> {
    let mut procs = state.running_processes.lock().await;
    if let Some(tx) = procs.remove(&pid) {
        let _ = tx.send(());
        return Ok(());
    }
    Err("Process not found".to_string())
}
