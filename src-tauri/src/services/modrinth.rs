use crate::paths::get_target_game_dir;
use crate::services::content::{
    read_installed_content, read_installed_mods, read_metadata_store, save_metadata_store,
    ContentItem,
};
use base64::Engine;
use futures_util::stream::{self, StreamExt};
use sha2::{Digest, Sha512};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::{Mutex, OnceLock};

pub const MODRINTH_API_BASE: &str = "https://api.modrinth.com/v2";
pub const USER_AGENT: &str = concat!("CesarGarza55/OpenLauncher/", env!("CARGO_PKG_VERSION"), " (support@codevbox.com)");
static INSTALLED_PROJECT_CACHE: OnceLock<
    Mutex<std::collections::HashMap<String, Option<serde_json::Value>>>,
> = OnceLock::new();

fn get_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .unwrap_or_default()
}

pub fn clean_minecraft_version(version: &str) -> String {
    let s = version.trim();
    if s.is_empty() || s.eq_ignore_ascii_case("all") || s.eq_ignore_ascii_case("auto") {
        return String::new();
    }
    if s.starts_with("fabric-loader") || s.starts_with("quilt-loader") {
        if let Some(pos) = s.rfind('-') {
            let ver = s[pos + 1..].trim();
            if !ver.is_empty() {
                return ver.to_string();
            }
        }
    }
    if let Some(pos) = s.rfind('-') {
        let suffix = s[pos + 1..].trim();
        let parts: Vec<&str> = suffix.split('.').collect();
        if parts.len() >= 2 && parts.iter().all(|p| p.chars().all(|c| c.is_ascii_digit())) {
            return suffix.to_string();
        }
    }
    for token in s.split(|c: char| c == '-' || c == '_' || c == ' ') {
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() >= 2 && parts.iter().all(|p| p.chars().all(|c| c.is_ascii_digit())) {
            if parts[0] == "1" || parts[0] == "26" {
                return token.to_string();
            }
        }
    }
    for token in s.split(|c: char| !c.is_ascii_digit() && c != '.') {
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() >= 2 && parts.iter().all(|p| p.chars().all(|c| c.is_ascii_digit())) {
            return token.to_string();
        }
    }
    s.to_string()
}

pub fn generate_shader_search_queries(file_name: &str) -> Vec<String> {
    let mut base = file_name.trim();
    if let Some(s) = base.strip_suffix(".disabled") {
        base = s;
    }
    if let Some(s) = base.strip_suffix(".zip") {
        base = s;
    }

    let mut clean1 = base.to_string();
    if let Some(idx) = clean1.rfind(|c| c == '_' || c == '-') {
        let suffix = &clean1[idx + 1..];
        if suffix.starts_with('v')
            || suffix.starts_with('r')
            || suffix.chars().next().map_or(false, |c| c.is_ascii_digit())
        {
            clean1.truncate(idx);
        }
    }

    let mut split_camel = String::new();
    let mut prev_lower = false;
    for ch in clean1.chars() {
        if ch.is_uppercase() && prev_lower {
            split_camel.push(' ');
        }
        if ch == '_' || ch == '-' {
            split_camel.push(' ');
            prev_lower = false;
        } else {
            prev_lower = ch.is_lowercase();
            split_camel.push(ch);
        }
    }
    let query1 = split_camel.split_whitespace().collect::<Vec<_>>().join(" ");

    let filtered_words: Vec<&str> = query1
        .split_whitespace()
        .filter(|w| {
            let lower = w.to_lowercase();
            lower != "lite"
                && lower != "ultra"
                && lower != "plus"
                && lower != "fast"
                && lower != "medium"
                && lower != "high"
                && lower != "extreme"
                && lower != "shader"
                && lower != "shaders"
                && lower != "pack"
        })
        .collect();
    let query2 = filtered_words.join(" ");

    let first_word = base
        .split(|c| c == '_' || c == '-' || c == ' ')
        .next()
        .unwrap_or("")
        .to_string();

    let mut queries = Vec::new();
    if query1.len() >= 2 {
        queries.push(query1);
    }
    if query2.len() >= 2 && !queries.contains(&query2) {
        queries.push(query2);
    }
    if first_word.len() >= 2 && !queries.contains(&first_word) {
        queries.push(first_word);
    }
    queries
}

pub async fn enrich_installed_content(
    items: Vec<ContentItem>,
    project_type: &'static str,
) -> Vec<ContentItem> {
    let cache =
        INSTALLED_PROJECT_CACHE.get_or_init(|| Mutex::new(std::collections::HashMap::new()));
    let metadata_store = read_metadata_store();
    let new_discovered_meta: Mutex<HashMap<String, serde_json::Value>> =
        Mutex::new(HashMap::new());

    let mut enriched = stream::iter(items.into_iter().enumerate())
        .map(|(index, mut item)| {
            let cache_ref = cache;
            let meta_store_ref = &metadata_store;
            let new_meta_ref = &new_discovered_meta;
            async move {
                let has_full_metadata = item.icon.is_some()
                    && item
                        .description
                        .as_deref()
                        .is_some_and(|v| !v.trim().is_empty())
                    && item.author.as_deref().is_some_and(|v| !v.trim().is_empty());
                if has_full_metadata && item.project_id.is_some() {
                    return (index, item);
                }

                let lower_name = item.file_name.to_lowercase();
                let mut base_key = lower_name.as_str();
                if let Some(s) = base_key.strip_suffix(".disabled") {
                    base_key = s;
                }
                if let Some(s) = base_key.strip_suffix(".zip") {
                    base_key = s;
                }
                if let Some(s) = base_key.strip_suffix(".jar") {
                    base_key = s;
                }
                if let Some(s) = base_key.strip_suffix(".olpkg") {
                    base_key = s;
                }

                // 1. Check local metadata store first
                if let Some(cached_meta) = meta_store_ref
                    .get(base_key)
                    .or_else(|| meta_store_ref.get(&lower_name))
                    .or_else(|| meta_store_ref.get(&item.file_name))
                {
                    if let Some(title) = cached_meta
                        .get("displayName")
                        .or_else(|| cached_meta.get("title"))
                        .and_then(|v| v.as_str())
                    {
                        if !title.trim().is_empty() {
                            item.name = title.to_string();
                        }
                    }
                    if item.description.as_deref().unwrap_or("").trim().is_empty() {
                        if let Some(desc) = cached_meta
                            .get("description")
                            .and_then(|v| v.as_str())
                        {
                            item.description = Some(desc.to_string());
                        }
                    }
                    if item.author.as_deref().unwrap_or("").trim().is_empty() {
                        if let Some(author) = cached_meta
                            .get("authors")
                            .or_else(|| cached_meta.get("author"))
                            .and_then(|v| v.as_str())
                        {
                            item.author = Some(author.to_string());
                        }
                    }
                    if item.icon.is_none() {
                        if let Some(icon) = cached_meta
                            .get("iconUrl")
                            .or_else(|| cached_meta.get("icon"))
                            .and_then(|v| v.as_str())
                        {
                            item.icon = Some(icon.to_string());
                        }
                    }
                    if item.project_id.is_none() {
                        item.project_id = cached_meta
                            .get("projectId")
                            .or_else(|| cached_meta.get("project_id"))
                            .and_then(|v| v.as_str())
                            .map(str::to_string);
                    }
                    if item.modrinth_id.is_none() {
                        item.modrinth_id = cached_meta
                            .get("modrinthId")
                            .or_else(|| cached_meta.get("slug"))
                            .and_then(|v| v.as_str())
                            .map(str::to_string);
                    }
                    if item.icon.is_some() && item.description.is_some() {
                        return (index, item);
                    }
                }

                // 2. Generate search queries
                let queries = if project_type == "shader" {
                    generate_shader_search_queries(&item.file_name)
                } else {
                    let raw = item
                        .modrinth_id
                        .as_deref()
                        .or(item.project_id.as_deref())
                        .or(item.mod_id.as_deref())
                        .unwrap_or(&item.name)
                        .trim()
                        .to_string();
                    if raw.is_empty() {
                        vec![]
                    } else {
                        vec![raw]
                    }
                };

                let mut matched_project = None;
                for query in &queries {
                    let cache_key = format!("{}:{}", project_type, query.to_lowercase());
                    let cached = cache_ref
                        .lock()
                        .ok()
                        .and_then(|entries| entries.get(&cache_key).cloned());

                    let project = if let Some(cached) = cached {
                        cached
                    } else {
                        let search = search_modrinth_projects(serde_json::json!({
                            "query": query,
                            "projectType": project_type,
                            "limit": 5
                        }))
                        .await
                        .ok();

                        let query_tokens = query
                            .to_lowercase()
                            .split(|c: char| !c.is_alphanumeric())
                            .filter(|token| token.len() >= 2 && !token.chars().all(|c| c.is_ascii_digit()))
                            .map(str::to_string)
                            .collect::<Vec<_>>();

                        let candidate = search
                            .as_ref()
                            .and_then(|result| result.get("hits"))
                            .and_then(|hits| hits.as_array())
                            .and_then(|hits| {
                                if hits.is_empty() {
                                    return None;
                                }
                                hits.iter()
                                    .find(|hit| {
                                        let title = hit
                                            .get("title")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("")
                                            .to_lowercase();
                                        let slug = hit
                                            .get("slug")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("")
                                            .to_lowercase();
                                        let searchable = format!("{} {}", title, slug);
                                        if query_tokens.is_empty() {
                                            return true;
                                        }
                                        let matched = query_tokens
                                            .iter()
                                            .filter(|token| searchable.contains(token.as_str()))
                                            .count();
                                        (matched as f32 / query_tokens.len().max(1) as f32) >= 0.4
                                    })
                                    .cloned()
                            });

                        let project = if let Some(mut project) = candidate {
                            if let Some(icon_url) = project.get("icon_url").and_then(|v| v.as_str()) {
                                if let Ok(response) = get_client().get(icon_url).send().await {
                                    if response.status().is_success() {
                                        let mime = response
                                            .headers()
                                            .get(reqwest::header::CONTENT_TYPE)
                                            .and_then(|v| v.to_str().ok())
                                            .unwrap_or("image/png")
                                            .to_string();
                                        if let Ok(bytes) = response.bytes().await {
                                            project["icon_url"] = serde_json::Value::String(format!(
                                                "data:{};base64,{}",
                                                mime,
                                                base64::engine::general_purpose::STANDARD.encode(bytes)
                                            ));
                                        }
                                    }
                                }
                            }
                            Some(project)
                        } else {
                            None
                        };

                        if let Ok(mut entries) = cache_ref.lock() {
                            entries.insert(cache_key, project.clone());
                        }
                        project
                    };

                    if project.is_some() {
                        matched_project = project;
                        break;
                    }
                }

                if let Some(project) = matched_project {
                    item.project_id = project
                        .get("project_id")
                        .and_then(|v| v.as_str())
                        .map(str::to_string);
                    item.modrinth_id = project
                        .get("slug")
                        .and_then(|v| v.as_str())
                        .map(str::to_string);
                    if let Some(icon_url) = project.get("icon_url").and_then(|v| v.as_str()) {
                        if !icon_url.is_empty() {
                            item.icon = Some(icon_url.to_string());
                        }
                    }
                    if let Some(title) = project
                        .get("title")
                        .and_then(|v| v.as_str())
                        .filter(|v| !v.trim().is_empty())
                    {
                        item.name = title.to_string();
                    }
                    if item.description.as_deref().unwrap_or("").trim().is_empty() {
                        item.description = project
                            .get("description")
                            .and_then(|v| v.as_str())
                            .map(str::to_string);
                    }
                    if item.author.as_deref().unwrap_or("").trim().is_empty() {
                        item.author = project
                            .get("author")
                            .and_then(|v| v.as_str())
                            .map(str::to_string);
                    }
                    if item.loader.is_none() {
                        item.loader = project
                            .get("loaders")
                            .and_then(|v| v.as_array())
                            .map(|loaders| {
                                loaders
                                    .iter()
                                    .filter_map(|v| v.as_str())
                                    .collect::<Vec<_>>()
                                    .join(", ")
                            });
                    }

                    // Save to discovered metadata store so subsequent runs are instant
                    let meta_val = serde_json::json!({
                        "displayName": item.name,
                        "description": item.description.as_deref().unwrap_or(""),
                        "iconUrl": item.icon.as_deref().unwrap_or(""),
                        "authors": item.author.as_deref().unwrap_or(""),
                        "projectType": project_type,
                        "projectId": item.project_id,
                        "slug": item.modrinth_id,
                    });
                    if let Ok(mut discovered) = new_meta_ref.lock() {
                        discovered.insert(base_key.to_string(), meta_val.clone());
                        discovered.insert(lower_name.clone(), meta_val);
                    }
                }
                (index, item)
            }
        })
        .buffer_unordered(6)
        .collect::<Vec<_>>()
        .await;

    // Persist all newly discovered artwork/metadata
    if let Ok(discovered) = new_discovered_meta.lock() {
        if !discovered.is_empty() {
            save_metadata_store(&discovered);
        }
    }

    enriched.sort_by_key(|(index, _)| *index);
    enriched.into_iter().map(|(_, item)| item).collect()
}

pub async fn search_modrinth_projects(
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let client = get_client();
    let mut url = format!("{}/search?", MODRINTH_API_BASE);

    if let Some(q) = params.get("query").and_then(|v| v.as_str()) {
        url.push_str(&format!("query={}&", urlencoding::encode(q.trim())));
    }
    if let Some(limit) = params.get("limit").and_then(|v| v.as_u64()) {
        url.push_str(&format!("limit={}&", limit));
    }
    if let Some(offset) = params.get("offset").and_then(|v| v.as_u64()) {
        url.push_str(&format!("offset={}&", offset));
    }
    if let Some(index) = params.get("sortBy").and_then(|v| v.as_str()) {
        url.push_str(&format!("index={}&", index));
    }

    let mut facets: Vec<Vec<String>> = Vec::new();
    let raw_type = params
        .get("projectType")
        .and_then(|v| v.as_str())
        .unwrap_or("mod");
    let project_type = match raw_type {
        "shaders" | "shader" => "shader",
        "resourcepacks" | "resourcepack" => "resourcepack",
        "datapacks" | "datapack" => "datapack",
        _ => "mod",
    };
    facets.push(vec![format!("project_type:{}", project_type)]);

    if project_type == "mod" {
        if let Some(loader) = params.get("loader").and_then(|v| v.as_str()) {
            let l = loader.to_lowercase();
            if !l.is_empty() && l != "all" && l != "vanilla" && l != "auto" {
                facets.push(vec![format!("categories:{}", l)]);
            }
        }
    }
    if let Some(category) = params.get("category").and_then(|v| v.as_str()) {
        let c = category.to_lowercase();
        if !c.is_empty() && c != "all" {
            facets.push(vec![format!("categories:{}", c)]);
        }
    }
    if let Some(gv) = params.get("gameVersion").and_then(|v| v.as_str()) {
        let clean_gv = clean_minecraft_version(gv);
        if !clean_gv.is_empty() {
            facets.push(vec![format!("versions:{}", clean_gv)]);
        }
    }

    let facets_json = serde_json::to_string(&facets).unwrap_or_default();
    url.push_str(&format!("facets={}", urlencoding::encode(&facets_json)));

    let res: serde_json::Value = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    Ok(res)
}

pub async fn get_modrinth_project(id_or_slug: &str) -> Result<serde_json::Value, String> {
    let client = get_client();
    let url = format!("{}/project/{}", MODRINTH_API_BASE, id_or_slug);
    let res: serde_json::Value = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res)
}

pub async fn get_modrinth_project_versions(
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let client = get_client();
    let id_or_slug = params
        .get("idOrSlug")
        .or_else(|| params.get("projectId"))
        .and_then(|v| v.as_str())
        .ok_or("Missing project ID")?;
    let mut url = format!("{}/project/{}/version?", MODRINTH_API_BASE, id_or_slug);

    if let Some(loaders) = params.get("loaders").and_then(|v| v.as_array()) {
        let clean_loaders: Vec<String> = loaders
            .iter()
            .filter_map(|l| l.as_str())
            .map(|s| s.to_lowercase())
            .filter(|s| !s.is_empty() && s != "all" && s != "vanilla" && s != "auto")
            .collect();
        if !clean_loaders.is_empty() {
            let l_json = serde_json::to_string(&clean_loaders).unwrap_or_default();
            url.push_str(&format!("loaders={}&", urlencoding::encode(&l_json)));
        }
    }
    if let Some(gv) = params.get("gameVersions").and_then(|v| v.as_array()) {
        let clean_gvs: Vec<String> = gv
            .iter()
            .filter_map(|v| v.as_str())
            .map(clean_minecraft_version)
            .filter(|s| !s.is_empty())
            .collect();
        if !clean_gvs.is_empty() {
            let gv_json = serde_json::to_string(&clean_gvs).unwrap_or_default();
            url.push_str(&format!("game_versions={}&", urlencoding::encode(&gv_json)));
        }
    }

    let res: serde_json::Value = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res)
}

pub async fn get_modrinth_version(version_id: &str) -> Result<serde_json::Value, String> {
    let client = get_client();
    let url = format!("{}/version/{}", MODRINTH_API_BASE, urlencoding::encode(version_id));
    let res: serde_json::Value = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res)
}

pub async fn install_modrinth_project(
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let client = get_client();
    let project_id = payload.get("projectId").and_then(|v| v.as_str());
    let mut file_url = payload.get("fileUrl").and_then(|v| v.as_str()).map(str::to_owned);
    let mut file_name = payload.get("fileName").and_then(|v| v.as_str()).map(str::to_owned);

    let raw_type = payload
        .get("projectType")
        .and_then(|v| v.as_str())
        .unwrap_or("mod");
    let normalized_type = match raw_type {
        "shaders" | "shader" => "shader",
        "resourcepacks" | "resourcepack" => "resourcepack",
        "datapacks" | "datapack" => "datapack",
        _ => "mod",
    };

    let version_id = payload.get("versionId").and_then(|v| v.as_str());
    let mut resolved_version: Option<serde_json::Value> = None;

    if let Some(vid) = version_id {
        resolved_version = get_modrinth_version(vid).await.ok();
    }

    if resolved_version.is_none() && (file_url.is_none() || file_name.is_none()) {
        if let Some(project_id) = project_id {
            let mut filters = serde_json::json!({ "projectId": project_id });
            if normalized_type == "datapack" {
                filters["loaders"] = serde_json::json!(["datapack"]);
            } else if normalized_type == "mod" {
                if let Some(loader) = payload.get("loader").and_then(|v| v.as_str()) {
                    let l = loader.to_lowercase();
                    if !l.is_empty() && l != "all" && l != "vanilla" && l != "auto" {
                        filters["loaders"] = serde_json::json!([l]);
                    }
                }
            }
            if let Some(game_version) = payload.get("gameVersion").and_then(|v| v.as_str()) {
                let clean_gv = clean_minecraft_version(game_version);
                if !clean_gv.is_empty() {
                    filters["gameVersions"] = serde_json::json!([clean_gv]);
                }
            }

            let mut res = get_modrinth_project_versions(filters.clone())
                .await
                .ok()
                .and_then(|v| v.as_array().and_then(|a| a.first()).cloned());

            // If strict filtering returned nothing, retry with relaxed filters
            if res.is_none() {
                if normalized_type == "datapack" {
                    let relaxed = serde_json::json!({
                        "projectId": project_id,
                        "loaders": ["datapack"]
                    });
                    res = get_modrinth_project_versions(relaxed)
                        .await
                        .ok()
                        .and_then(|v| v.as_array().and_then(|a| a.first()).cloned());
                } else if normalized_type == "mod" {
                    if let Some(loader) = payload.get("loader").and_then(|v| v.as_str()) {
                        let l = loader.to_lowercase();
                        if !l.is_empty() && l != "all" && l != "vanilla" && l != "auto" {
                            let relaxed = serde_json::json!({
                                "projectId": project_id,
                                "loaders": [l]
                            });
                            res = get_modrinth_project_versions(relaxed)
                                .await
                                .ok()
                                .and_then(|v| v.as_array().and_then(|a| a.first()).cloned());
                        }
                    }
                }
            }

            // Final fallback: fetch latest project version regardless of filters
            if res.is_none() {
                let any_version = serde_json::json!({ "projectId": project_id });
                res = get_modrinth_project_versions(any_version)
                    .await
                    .ok()
                    .and_then(|v| v.as_array().and_then(|a| a.first()).cloned());
            }

            resolved_version = res;
        }
    }

    if file_url.is_none() || file_name.is_none() {
        let selected_file = resolved_version.as_ref().and_then(|v| {
            v.get("files").and_then(|f| f.as_array()).and_then(|files| {
                files
                    .iter()
                    .find(|f| f.get("primary").and_then(|p| p.as_bool()).unwrap_or(false))
                    .or_else(|| files.first())
            })
        });

        if file_url.is_none() {
            file_url = selected_file
                .and_then(|f| f.get("url").and_then(|v| v.as_str()).map(str::to_owned));
        }
        if file_name.is_none() {
            file_name = selected_file
                .and_then(|f| f.get("filename").and_then(|v| v.as_str()).map(str::to_owned));
        }
    }

    let file_url = file_url.ok_or("Modrinth version has no downloadable file URL")?;
    let file_name = file_name.ok_or("Modrinth version has no filename")?;
    let replace_file_name = payload.get("replaceFileName").and_then(|v| v.as_str());
    let instance_id = payload.get("instanceId").and_then(|v| v.as_str());

    let target_folder = match normalized_type {
        "shader" => "shaderpacks",
        "resourcepack" => "resourcepacks",
        "datapack" => "datapacks",
        _ => "mods",
    };

    let dest_dir = get_target_game_dir(instance_id).join(target_folder);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    let dest_file = dest_dir.join(&file_name);
    let bytes = client
        .get(&file_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    fs::write(&dest_file, bytes).map_err(|e| e.to_string())?;

    if let Some(old_name) = replace_file_name.filter(|old| *old != file_name) {
        let old_path = dest_dir.join(old_name);
        if old_path.parent() == Some(dest_dir.as_path()) && old_path.is_file() {
            let _ = fs::remove_file(&old_path);
        }
        let old_disabled = dest_dir.join(format!("{}.disabled", old_name));
        if old_disabled.parent() == Some(dest_dir.as_path()) && old_disabled.is_file() {
            let _ = fs::remove_file(&old_disabled);
        }
    }

    if let Some(pid) = project_id {
        let pid_clean = pid.to_lowercase();
        if let Ok(entries) = fs::read_dir(&dest_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if let Some(fname) = p.file_name().and_then(|s| s.to_str()) {
                    let flower = fname.to_lowercase();
                    if flower != file_name.to_lowercase()
                        && (flower.ends_with(".jar")
                            || flower.ends_with(".jar.disabled")
                            || flower.ends_with(".zip"))
                    {
                        let is_target = if flower.starts_with(&format!("{}-", pid_clean))
                            || flower.starts_with(&format!("{}_", pid_clean))
                            || flower == format!("{}.jar", pid_clean)
                            || flower == format!("{}.zip", pid_clean)
                        {
                            let is_companion = (pid_clean == "sodium"
                                && (flower.contains("extra")
                                    || flower.contains("reeses")
                                    || flower.contains("options")))
                                || (pid_clean == "iris" && flower.contains("flawless"));
                            !is_companion
                        } else {
                            false
                        };
                        if is_target {
                            let _ = fs::remove_file(&p);
                        }
                    }
                }
            }
        }
    }

    // Install required dependencies if this is a mod
    if normalized_type == "mod" {
        if let Some(deps) = resolved_version
            .as_ref()
            .and_then(|v| v.get("dependencies"))
            .and_then(|d| d.as_array())
        {
            for dep in deps {
                let is_required = dep
                    .get("dependency_type")
                    .and_then(|t| t.as_str())
                    == Some("required");
                if !is_required {
                    continue;
                }

                let dep_project_id = dep.get("project_id").and_then(|v| v.as_str());
                let dep_version_id = dep.get("version_id").and_then(|v| v.as_str());

                let already_installed = if let Some(pid) = dep_project_id {
                    let pid_lower = pid.to_lowercase();
                    if let Ok(entries) = fs::read_dir(&dest_dir) {
                        entries.flatten().any(|e| {
                            let n = e.file_name().to_string_lossy().to_lowercase();
                            (n.ends_with(".jar") || n.ends_with(".jar.disabled"))
                                && (n.starts_with(&format!("{}-", pid_lower))
                                    || n.starts_with(&format!("{}_", pid_lower))
                                    || n == format!("{}.jar", pid_lower))
                        })
                    } else {
                        false
                    }
                } else {
                    false
                };

                if already_installed {
                    continue;
                }

                let dep_version = if let Some(vid) = dep_version_id {
                    get_modrinth_version(vid).await.ok()
                } else if let Some(pid) = dep_project_id {
                    let mut dep_params = serde_json::json!({
                        "projectId": pid,
                    });
                    if let Some(l) = payload.get("loader").and_then(|v| v.as_str()) {
                        dep_params["loader"] = serde_json::Value::String(l.to_string());
                    }
                    if let Some(gv) = payload.get("gameVersion").and_then(|v| v.as_str()) {
                        dep_params["gameVersion"] = serde_json::Value::String(gv.to_string());
                    }
                    get_modrinth_project_versions(dep_params)
                        .await
                        .ok()
                        .and_then(|v| v.as_array().and_then(|a| a.first()).cloned())
                } else {
                    None
                };

                if let Some(dv) = dep_version {
                    let dep_file = dv.get("files").and_then(|f| f.as_array()).and_then(|files| {
                        files
                            .iter()
                            .find(|f| f.get("primary").and_then(|p| p.as_bool()).unwrap_or(false))
                            .or_else(|| files.first())
                    });

                    if let (Some(url), Some(fname)) = (
                        dep_file.and_then(|f| f.get("url").and_then(|v| v.as_str())),
                        dep_file.and_then(|f| f.get("filename").and_then(|v| v.as_str())),
                    ) {
                        let dep_dest = dest_dir.join(fname);
                        if !dep_dest.exists() {
                            if let Ok(resp) = client.get(url).send().await {
                                if let Ok(b) = resp.bytes().await {
                                    let _ = fs::write(&dep_dest, b);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Save project metadata to mods-metadata.json so it is permanently cached
    if let Some(project_id) = project_id {
        if let Ok(project) = get_modrinth_project(project_id).await {
            let mut cached_icon = None;
            if let Some(icon_url) = project.get("icon_url").and_then(|v| v.as_str()) {
                if let Ok(res) = client.get(icon_url).send().await {
                    if res.status().is_success() {
                        let mime = res
                            .headers()
                            .get(reqwest::header::CONTENT_TYPE)
                            .and_then(|v| v.to_str().ok())
                            .unwrap_or("image/png")
                            .to_string();
                        if let Ok(b) = res.bytes().await {
                            cached_icon = Some(format!(
                                "data:{};base64,{}",
                                mime,
                                base64::engine::general_purpose::STANDARD.encode(b)
                            ));
                        }
                    }
                }
            }

            let mut file_key = file_name.to_lowercase();
            if let Some(s) = file_key.strip_suffix(".disabled") {
                file_key = s.to_string();
            }
            if let Some(s) = file_key.strip_suffix(".jar") {
                file_key = s.to_string();
            } else if let Some(s) = file_key.strip_suffix(".zip") {
                file_key = s.to_string();
            } else if let Some(s) = file_key.strip_suffix(".olpkg") {
                file_key = s.to_string();
            }

            let meta_val = serde_json::json!({
                "displayName": project.get("title").and_then(|v| v.as_str()).unwrap_or(&file_name),
                "description": project.get("description").and_then(|v| v.as_str()).unwrap_or(""),
                "iconUrl": cached_icon.or_else(|| project.get("icon_url").and_then(|v| v.as_str()).map(str::to_string)),
                "authors": project.get("author").and_then(|v| v.as_str()).unwrap_or(""),
                "projectType": normalized_type,
                "projectId": project_id,
                "slug": project.get("slug").and_then(|v| v.as_str()).unwrap_or(project_id),
            });

            let mut meta_entries = HashMap::new();
            meta_entries.insert(file_key, meta_val.clone());
            meta_entries.insert(file_name.to_lowercase(), meta_val);
            save_metadata_store(&meta_entries);
        }
    }

    let updated_content = match normalized_type {
        "shader" => read_installed_content("shaderpacks", instance_id),
        "resourcepack" => read_installed_content("resourcepacks", instance_id),
        "datapack" => read_installed_content("datapacks", instance_id),
        _ => read_installed_mods(instance_id),
    };

    Ok(serde_json::json!({
        "ok": true,
        "fileName": file_name,
        "path": dest_file.to_string_lossy().to_string(),
        "projectType": normalized_type,
        "items": updated_content,
        "mods": updated_content,
    }))
}

pub async fn check_installed_mods_updates(
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let instance_id = params.get("instanceId").and_then(|v| v.as_str());
    let mods = read_installed_mods(instance_id);

    let mut hashes = Vec::new();
    let mut file_map = std::collections::HashMap::new();

    for m in mods {
        let p = Path::new(&m.path);
        if let Ok(data) = fs::read(p) {
            let mut hasher = Sha512::new();
            hasher.update(&data);
            let hash = format!("{:x}", hasher.finalize());
            hashes.push(hash.clone());
            file_map.insert(hash, m);
        }
    }

    if hashes.is_empty() {
        return Ok(serde_json::json!({ "updates": [] }));
    }

    let client = get_client();
    let loader = params
        .get("loader")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    let loaders = if loader.is_empty() || loader == "all" || loader == "vanilla" {
        vec!["fabric", "quilt", "forge", "neoforge"]
    } else {
        vec![loader.as_str()]
    };
    let game_version = params
        .get("gameVersion")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let game_versions: Vec<&str> = if game_version.is_empty() || game_version == "all" {
        Vec::new()
    } else {
        vec![game_version]
    };
    let payload = serde_json::json!({
        "hashes": hashes,
        "algorithm": "sha512",
        "loaders": loaders,
        "game_versions": game_versions
    });

    let res: serde_json::Value = client
        .post(format!("{}/version_files/update", MODRINTH_API_BASE))
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mut updates = serde_json::Map::new();
    if let Some(matches) = res.as_object() {
        for (hash, version) in matches {
            let Some(installed) = file_map.get(hash) else {
                continue;
            };
            let primary = version
                .get("files")
                .and_then(|v| v.as_array())
                .and_then(|files| {
                    files
                        .iter()
                        .find(|f| f.get("primary").and_then(|v| v.as_bool()) == Some(true))
                        .or_else(|| files.first())
                });
            let Some(primary) = primary else { continue };
            let new_hash = primary
                .get("hashes")
                .and_then(|v| v.get("sha512"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if new_hash.is_empty() || new_hash == hash {
                continue;
            }

            let file_name = &installed.file_name;
            let file_key = file_name
                .trim_end_matches(".disabled")
                .trim_end_matches(".jar")
                .to_lowercase();
            let info = serde_json::json!({
                "fileName": file_name,
                "fileKey": file_key,
                "currentHash": hash,
                "newVersionNumber": version.get("version_number"),
                "newVersionName": version.get("name"),
                "versionId": version.get("id"),
                "projectId": version.get("project_id"),
                "changelog": version.get("changelog"),
                "datePublished": version.get("date_published"),
                "fileUrl": primary.get("url"),
                "targetFileName": primary.get("filename").and_then(|v| v.as_str()).unwrap_or(file_name),
                "fileSize": primary.get("size")
            });
            updates.insert(file_name.clone(), info.clone());
            updates.insert(file_key, info);
        }
    }

    let count = updates
        .keys()
        .filter(|key| key.ends_with(".jar") || key.ends_with(".jar.disabled"))
        .count();
    Ok(serde_json::json!({ "updates": updates, "count": count }))
}
