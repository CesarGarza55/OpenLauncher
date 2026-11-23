use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const MOJANG_NEWS_V2_URL: &str = "https://launchercontent.mojang.com/v2/news.json";
pub const MINECRAFT_ARTICLES_URL: &str = "https://www.minecraft.net/en-us/articles";
pub const MOJANG_CONTENT_HOST: &str = "https://launchercontent.mojang.com";

const NEWS_CACHE_TTL_SECS: u64 = 1800; // 30 minutes cache validity

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewsItem {
    pub title: String,
    pub summary: String,
    pub author: String,
    pub published: String,
    pub url: String,
    pub image: String,
    pub source: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewsResponse {
    pub items: Vec<NewsItem>,
    #[serde(rename = "sourceUrl")]
    pub source_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct DiskNewsCache {
    pub timestamp: u64,
    pub etag: Option<String>,
    pub response: NewsResponse,
}

fn get_news_cache_file() -> PathBuf {
    let base = crate::paths::get_launcher_data_dir();
    let cache_dir = base.join("cache");
    let _ = std::fs::create_dir_all(&cache_dir);
    cache_dir.join("news_cache.json")
}

fn read_disk_cache() -> Option<DiskNewsCache> {
    let path = get_news_cache_file();
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

fn write_disk_cache(cache: &DiskNewsCache) {
    let path = get_news_cache_file();
    if let Ok(json) = serde_json::to_string(cache) {
        let _ = std::fs::write(path, json);
    }
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub async fn load_minecraft_news(limit: usize) -> Result<NewsResponse, String> {
    let now = current_timestamp();
    let cached = read_disk_cache();

    // If cache is fresh (< 30 minutes) and has items, return immediately without network call
    if let Some(ref c) = cached {
        if !c.response.items.is_empty() && (now.saturating_sub(c.timestamp) < NEWS_CACHE_TTL_SECS) {
            let mut res = c.response.clone();
            if res.items.len() > limit {
                res.items.truncate(limit);
            }
            return Ok(res);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent(concat!("OpenLauncher/", env!("CARGO_PKG_VERSION"), " (support@codevbox.com)"))
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(MOJANG_NEWS_V2_URL);
    if let Some(ref c) = cached {
        if let Some(ref etag) = c.etag {
            req = req.header(reqwest::header::IF_NONE_MATCH, etag);
        }
    }

    match req.send().await {
        Ok(res) => {
            if res.status() == reqwest::StatusCode::NOT_MODIFIED {
                if let Some(mut c) = cached {
                    c.timestamp = now;
                    write_disk_cache(&c);
                    let mut resp = c.response;
                    if resp.items.len() > limit {
                        resp.items.truncate(limit);
                    }
                    return Ok(resp);
                }
            }

            if !res.status().is_success() {
                // If network returned an error status but we have cache, fallback to cache
                if let Some(c) = cached {
                    let mut resp = c.response;
                    if resp.items.len() > limit {
                        resp.items.truncate(limit);
                    }
                    return Ok(resp);
                }
                return Ok(NewsResponse {
                    items: Vec::new(),
                    source_url: MINECRAFT_ARTICLES_URL.to_string(),
                });
            }

            let new_etag = res
                .headers()
                .get(reqwest::header::ETAG)
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string());

            let val: serde_json::Value = match res.json().await {
                Ok(v) => v,
                Err(_) => {
                    if let Some(c) = cached {
                        let mut resp = c.response;
                        if resp.items.len() > limit {
                            resp.items.truncate(limit);
                        }
                        return Ok(resp);
                    }
                    return Ok(NewsResponse {
                        items: Vec::new(),
                        source_url: MINECRAFT_ARTICLES_URL.to_string(),
                    });
                }
            };

            let mut items = Vec::new();

            if let Some(entries) = val.get("entries").and_then(|e| e.as_array()) {
                let mut sorted_entries = entries.clone();
                sorted_entries.sort_by(|a, b| {
                    let date_a = a.get("date").and_then(|d| d.as_str()).unwrap_or("");
                    let date_b = b.get("date").and_then(|d| d.as_str()).unwrap_or("");
                    date_b.cmp(date_a)
                });

                for entry in sorted_entries.iter() {
                    let title = entry
                        .get("title")
                        .and_then(|t| t.as_str())
                        .unwrap_or("")
                        .to_string();
                    if title.is_empty() {
                        continue;
                    }

                    let text = entry
                        .get("text")
                        .and_then(|t| t.as_str())
                        .unwrap_or("")
                        .trim()
                        .to_string();
                    let category = entry
                        .get("category")
                        .and_then(|c| c.as_str())
                        .unwrap_or("Minecraft")
                        .to_string();
                    let date = entry
                        .get("date")
                        .and_then(|d| d.as_str())
                        .unwrap_or("")
                        .to_string();
                    let read_more = entry
                        .get("readMoreLink")
                        .and_then(|l| l.as_str())
                        .unwrap_or(MINECRAFT_ARTICLES_URL)
                        .to_string();

                    let rel_img = entry
                        .get("playPageImage")
                        .and_then(|i| i.get("url"))
                        .or_else(|| entry.get("newsPageImage").and_then(|i| i.get("url")))
                        .and_then(|u| u.as_str())
                        .unwrap_or("");

                    let image = if rel_img.is_empty() {
                        "".to_string()
                    } else if rel_img.starts_with("http") {
                        rel_img.to_string()
                    } else {
                        format!("{}{}", MOJANG_CONTENT_HOST, rel_img)
                    };

                    items.push(NewsItem {
                        title,
                        summary: text,
                        author: category,
                        published: date,
                        url: read_more,
                        image,
                        source: "mojang".to_string(),
                    });
                }
            }

            let full_response = NewsResponse {
                items,
                source_url: MINECRAFT_ARTICLES_URL.to_string(),
            };

            // Save full list to disk cache
            let disk_cache = DiskNewsCache {
                timestamp: now,
                etag: new_etag,
                response: full_response.clone(),
            };
            write_disk_cache(&disk_cache);

            let mut result_response = full_response;
            if result_response.items.len() > limit {
                result_response.items.truncate(limit);
            }
            Ok(result_response)
        }
        Err(_) => {
            // Network failed or offline: return cached response if available
            if let Some(c) = cached {
                let mut resp = c.response;
                if resp.items.len() > limit {
                    resp.items.truncate(limit);
                }
                return Ok(resp);
            }
            Ok(NewsResponse {
                items: Vec::new(),
                source_url: MINECRAFT_ARTICLES_URL.to_string(),
            })
        }
    }
}

pub async fn load_minecraft_article(url: &str) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        // Match the Electron fetchHtml request. minecraft.net can stall when
        // this request uses the launcher's generic product user agent.
        .user_agent("OpenLauncher-News")
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                reqwest::header::ACCEPT,
                "text/html,application/xhtml+xml".parse().unwrap(),
            );
            headers
        })
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "Article request failed: HTTP {}",
            response.status()
        ));
    }
    let html = response.text().await.map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "url": url,
        "html": html,
    }))
}
