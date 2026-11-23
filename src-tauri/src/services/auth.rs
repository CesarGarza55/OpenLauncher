use crate::paths::get_auth_store_path;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

pub const DEFAULT_CLIENT_ID: &str = "3f59fbe7-2c4b-4343-9a61-c03104ddaedf";
pub const REDIRECT_URI: &str = "http://localhost:8080/callback";
const LOGIN_SUCCESS_URL: &str = "https://openlauncher.codevbox.com/login-success";
const LOGIN_FAILED_URL: &str = "https://openlauncher.codevbox.com/login-failed";

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AuthAccountInfo {
    pub name: String,
    pub uuid: String,
    #[serde(alias = "accessToken", alias = "access_token")]
    pub token: String,
    #[serde(default, alias = "refreshToken", alias = "refresh_token")]
    pub refresh_token: Option<String>,
    #[serde(default, alias = "expiresAt", alias = "expires_at")]
    pub expires_at: Option<u64>,
    #[serde(default)]
    pub skins: Option<serde_json::Value>,
    #[serde(default)]
    pub capes: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AuthStore {
    #[serde(default, alias = "profiles")]
    pub accounts: HashMap<String, AuthAccountInfo>,
}

pub fn load_auth_store() -> AuthStore {
    let p = get_auth_store_path();
    if p.is_file() {
        if let Ok(content) = fs::read_to_string(p) {
            if let Ok(store) = serde_json::from_str::<AuthStore>(&content) {
                return store;
            }
        }
    }
    AuthStore::default()
}

pub fn save_auth_store(store: &AuthStore) -> Result<(), String> {
    let p = get_auth_store_path();
    if let Some(parent) = p.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::json!({
        "accounts": store.accounts,
        "profiles": store.accounts
    });
    let s = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
    fs::write(p, s).map_err(|e| e.to_string())
}

pub fn get_microsoft_auth_state(profile_key: &str) -> Option<AuthAccountInfo> {
    let store = load_auth_store();
    store.accounts.get(profile_key).cloned()
}

pub fn logout_microsoft(profile_key: &str) -> Result<(), String> {
    let mut store = load_auth_store();
    store.accounts.remove(profile_key);
    save_auth_store(&store)
}

pub async fn login_microsoft_interactive(profile_key: &str) -> Result<AuthAccountInfo, String> {
    let listener = TcpListener::bind("127.0.0.1:8080")
        .await
        .map_err(|e| format!("Failed to bind local port 8080: {}", e))?;

    let auth_url = format!(
        "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id={}&response_type=code&redirect_uri={}&scope=XboxLive.signin%20offline_access&prompt=select_account",
        DEFAULT_CLIENT_ID,
        urlencoding::encode(REDIRECT_URI)
    );

    // Open browser
    let _ = open::that(&auth_url);

    // Wait for HTTP GET /callback?code=...
    let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).await.map_err(|e| e.to_string())?;
    let req_str = String::from_utf8_lossy(&buf[..n]);

    let callback_path = req_str
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .unwrap_or("/");
    let query = callback_path
        .split_once('?')
        .map(|(_, query)| query)
        .unwrap_or("");
    let params: HashMap<String, String> = query
        .split('&')
        .filter_map(|part| {
            let (key, value) = part.split_once('=')?;
            Some((
                urlencoding::decode(key).ok()?.into_owned(),
                urlencoding::decode(value).ok()?.into_owned(),
            ))
        })
        .collect();

    let redirect = if params.contains_key("error") {
        LOGIN_FAILED_URL
    } else {
        LOGIN_SUCCESS_URL
    };
    let response = format!(
        "HTTP/1.1 302 Found\r\nLocation: {}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
        redirect
    );
    let _ = stream.write_all(response.as_bytes()).await;
    if let Some(error) = params.get("error") {
        return Err(format!("Microsoft login failed: {}", error));
    }

    let code = params
        .get("code")
        .cloned()
        .ok_or("Failed to extract authorization code from Microsoft callback")?;

    // Exchange code for MSA token
    let client = reqwest::Client::new();
    let token_params = [
        ("client_id", DEFAULT_CLIENT_ID),
        ("code", &code),
        ("grant_type", "authorization_code"),
        ("redirect_uri", REDIRECT_URI),
    ];

    let msa_res: serde_json::Value = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&token_params)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let access_token = msa_res
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or("No access token in MSA response")?;
    let refresh_token = msa_res
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // 1. Authenticate with Xbox Live
    let xbl_payload = serde_json::json!({
        "Properties": {
            "AuthMethod": "RPS",
            "SiteName": "user.auth.xboxlive.com",
            "RpsTicket": format!("d={}", access_token)
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT"
    });

    let xbl_res: serde_json::Value = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&xbl_payload)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let xbl_token = xbl_res
        .get("Token")
        .and_then(|t| t.as_str())
        .ok_or("Failed to get XBL token")?;
    let user_hash = xbl_res
        .get("DisplayClaims")
        .and_then(|d| d.get("xui"))
        .and_then(|x| x.as_array())
        .and_then(|a| a.first())
        .and_then(|f| f.get("uhs"))
        .and_then(|u| u.as_str())
        .ok_or("Failed to get user hash")?;

    // 2. Obtain XSTS Token
    let xsts_payload = serde_json::json!({
        "Properties": {
            "SandboxId": "RETAIL",
            "UserTokens": [xbl_token]
        },
        "RelyingParty": "rp://api.minecraftservices.com/",
        "TokenType": "JWT"
    });

    let xsts_res: serde_json::Value = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&xsts_payload)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let xsts_token = xsts_res
        .get("Token")
        .and_then(|t| t.as_str())
        .ok_or("Failed to get XSTS token")?;

    // 3. Login to Minecraft
    let mc_payload = serde_json::json!({
        "identityToken": format!("XBL3.0 x={};{}", user_hash, xsts_token)
    });

    let mc_auth_res: serde_json::Value = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&mc_payload)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mc_token = mc_auth_res
        .get("access_token")
        .and_then(|t| t.as_str())
        .ok_or("Failed to get Minecraft access token")?;

    // 4. Fetch Minecraft Profile
    let profile_res: serde_json::Value = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(mc_token)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let name = profile_res
        .get("name")
        .and_then(|n| n.as_str())
        .ok_or("Account does not own Minecraft")?;
    let uuid = profile_res
        .get("id")
        .and_then(|i| i.as_str())
        .ok_or("Missing Minecraft UUID")?;

    let account_info = AuthAccountInfo {
        name: name.to_string(),
        uuid: uuid.to_string(),
        token: mc_token.to_string(),
        refresh_token,
        expires_at: Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
                + 86400,
        ),
        skins: profile_res.get("skins").cloned(),
        capes: profile_res.get("capes").cloned(),
    };

    let mut store = load_auth_store();
    store
        .accounts
        .insert(profile_key.to_string(), account_info.clone());
    save_auth_store(&store)?;

    Ok(account_info)
}
