use anyhow::{anyhow, Result};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::Duration;
use std::fs;
use std::path::PathBuf;
use base64::Engine;
use tauri::Manager;
use chrono::DateTime;

#[derive(Serialize, Deserialize, Debug)]
struct GoogleTokens {
  access_token: String,
  expires_in: Option<u64>,
  refresh_token: Option<String>,
  scope: Option<String>,
  token_type: Option<String>,
  id_token: Option<String>,
  obtained_at_ms: u128,
}

fn b64_url_no_pad(input: &[u8]) -> String {
  base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(input)
}

fn generate_pkce_pair() -> (String, String) {
  // code_verifier must be 43-128 chars
  let verifier: String = rand::thread_rng()
    .sample_iter(&Alphanumeric)
    .take(64)
    .map(char::from)
    .collect();
  let challenge = {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let digest = hasher.finalize();
    b64_url_no_pad(&digest)
  };
  (verifier, challenge)
}

fn load_env(var: &str) -> Result<String> {
  std::env::var(var).map_err(|_| anyhow!("Missing environment variable: {}", var))
}

fn tokens_path(app: &tauri::AppHandle) -> Result<PathBuf> {
  let mut path = app
    .path()
    .app_data_dir()
    .map_err(|e| anyhow!("Failed to resolve app data dir: {}", e))?;
  path.push("google_oauth");
  fs::create_dir_all(&path).ok();
  path.push("tokens.json");
  Ok(path)
}

fn save_tokens(app: &tauri::AppHandle, tokens: &GoogleTokens) -> Result<()> {
  let path = tokens_path(app)?;
  let json = serde_json::to_string_pretty(tokens)?;
  fs::write(&path, json)?;
  
  // Automatically bridge tokens to MCP directories and credential store
  let _ = bridge_tokens_to_mcp(app, tokens);
  
  Ok(())
}

fn extract_email_from_id_token(id_token: &str) -> Option<String> {
  let parts: Vec<&str> = id_token.split('.').collect();
  if parts.len() != 3 { return None; }
  let payload_b64 = parts[1];
  let pad_len = (4 - (payload_b64.len() % 4)) % 4;
  let padded = format!("{}{}", payload_b64, "=".repeat(pad_len));
  let decoded = base64::engine::general_purpose::URL_SAFE.decode(padded).ok()?;
  let payload: serde_json::Value = serde_json::from_slice(&decoded).ok()?;
  payload.get("email").and_then(|e| e.as_str()).map(|s| s.to_string())
}

fn get_user_email_from_api(access_token: &str) -> Option<String> {
  let client = reqwest::blocking::Client::new();
  let resp = client
    .get("https://openidconnect.googleapis.com/v1/userinfo")
    .bearer_auth(access_token)
    .send()
    .ok()?;
  if !resp.status().is_success() { return None; }
  let v: serde_json::Value = resp.json().ok()?;
  v.get("email").and_then(|e| e.as_str()).map(|s| s.to_string())
}

fn bridge_tokens_to_mcp(_app: &tauri::AppHandle, tokens: &GoogleTokens) -> Result<()> {
  // Determine user email
  let user_email = if let Some(ref idt) = tokens.id_token {
    extract_email_from_id_token(idt)
  } else { None }
  .or_else(|| get_user_email_from_api(&tokens.access_token))
  .unwrap_or_else(|| "default@example.com".to_string());
  println!("[OAuth][Bridge] Derived user email: {}", user_email);

  // Compute expiry as ISO8601 naive string (YYYY-MM-DDTHH:MM:SS[.ffffff])
  let expiry_iso: Option<String> = if let Some(expires_in) = tokens.expires_in {
    let expiry_ms: u128 = tokens.obtained_at_ms + (expires_in as u128 * 1000);
    let secs = (expiry_ms / 1000) as i64;
    let nanos = ((expiry_ms % 1000) as u32) * 1_000_000;
    if let Some(dt) = DateTime::from_timestamp(secs, nanos) {
      Some(dt.naive_utc().format("%Y-%m-%dT%H:%M:%S%.6f").to_string())
    } else { None }
  } else { None };

  // Prepare credentials in the Python store format
  let scopes_vec: Vec<String> = tokens
    .scope
    .as_ref()
    .map(|s| s.split(' ').map(|x| x.to_string()).collect())
    .unwrap_or_else(|| Vec::new());

  let store_credentials = serde_json::json!({
    "token": tokens.access_token,
    "refresh_token": tokens.refresh_token,
    "token_uri": "https://oauth2.googleapis.com/token",
    "client_id": std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
    "client_secret": std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default(),
    "scopes": scopes_vec,
    "expiry": expiry_iso,
  });

  // Write to ~/.google_workspace_mcp/credentials/{email}.json (or GOOGLE_MCP_CREDENTIALS_DIR)
  let base_dir = if let Ok(dir) = std::env::var("GOOGLE_MCP_CREDENTIALS_DIR") {
    std::path::PathBuf::from(dir)
  } else if let Some(home) = dirs::home_dir() {
    home.join(".google_workspace_mcp").join("credentials")
  } else {
    std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
      .join(".credentials")
  };
  fs::create_dir_all(&base_dir)?;
  let user_path = base_dir.join(format!("{}.json", user_email));
  let json_str = serde_json::to_string_pretty(&store_credentials)?;
  fs::write(&user_path, json_str)?;
  println!("[OAuth][Bridge] Wrote MCP credentials to {:?}", user_path);

  // Maintain existing legacy MCP outputs for Calendar/Gmail
  let home_dir = dirs::home_dir().ok_or_else(|| anyhow!("Could not find home directory"))?;
  let calendar_config_dir = home_dir.join(".calendar-mcp");
  let gmail_config_dir = home_dir.join(".gmail-mcp");
  fs::create_dir_all(&calendar_config_dir)?;
  fs::create_dir_all(&gmail_config_dir)?;

  let legacy = serde_json::json!({
    "access_token": tokens.access_token,
    "refresh_token": tokens.refresh_token,
    "scope": tokens.scope,
    "token_type": tokens.token_type.as_ref().unwrap_or(&"Bearer".to_string()),
    "expiry_date": if let Some(expires_in) = tokens.expires_in { tokens.obtained_at_ms + (expires_in as u128 * 1000) } else { tokens.obtained_at_ms + (3600 * 1000) }
  });
  let calendar_creds_path = calendar_config_dir.join("credentials.json");
  let gmail_creds_path = gmail_config_dir.join("credentials.json");
  let legacy_json = serde_json::to_string_pretty(&legacy)?;
  fs::write(&calendar_creds_path, &legacy_json)?;
  fs::write(&gmail_creds_path, &legacy_json)?;
  println!("[OAuth][Bridge] Wrote legacy credentials: {:?}, {:?}", calendar_creds_path, gmail_creds_path);

  if let Ok(client_id) = std::env::var("GOOGLE_CLIENT_ID") {
    let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default();
    let oauth_config = serde_json::json!({
      "installed": {
        "client_id": client_id,
        "client_secret": client_secret,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["http://localhost:3000/oauth2callback"]
      }
    });
    let calendar_oauth_path = calendar_config_dir.join("gcp-oauth.keys.json");
    let gmail_oauth_path = gmail_config_dir.join("gcp-oauth.keys.json");
    let oauth_json = serde_json::to_string_pretty(&oauth_config)?;
    fs::write(&calendar_oauth_path, &oauth_json)?;
    fs::write(&gmail_oauth_path, &oauth_json)?;
    println!("[OAuth][Bridge] Wrote legacy oauth keys: {:?}, {:?}", calendar_oauth_path, gmail_oauth_path);
  }

  Ok(())
}

fn open_in_browser(url: &str) -> Result<()> {
  if webbrowser::open(url).is_ok() {
    Ok(())
  } else {
    Err(anyhow!("Failed to open browser for URL"))
  }
}

#[tauri::command]
pub fn is_google_connected(app: tauri::AppHandle) -> Result<bool, String> {
  let path = match tokens_path(&app) {
    Ok(p) => p,
    Err(e) => {
      eprintln!("[OAuth][Status] Failed to resolve tokens path: {}", e);
      return Ok(false);
    },
  };
  let exists = path.exists();
  println!("[OAuth][Status] Tokens path: {:?}, exists: {}", path, exists);
  Ok(exists)
}

#[tauri::command]
pub fn disconnect_google_suite(app: tauri::AppHandle) -> Result<String, String> {
  println!("[OAuth][Disconnect] Starting disconnect flow...");
  // Attempt token revoke (best-effort)
  let path = tokens_path(&app).map_err(|e| e.to_string())?;
  if path.exists() {
    println!("[OAuth][Disconnect] Found tokens at {:?}. Attempting revoke...", path);
    if let Ok(content) = fs::read_to_string(&path) {
      if let Ok(tokens) = serde_json::from_str::<GoogleTokens>(&content) {
        let has_refresh = tokens.refresh_token.is_some();
        println!("[OAuth][Disconnect] Using {} token for revoke", if has_refresh {"refresh"} else {"access"});
        let revoke_token = tokens.refresh_token.as_deref().unwrap_or(&tokens.access_token);
        let client = reqwest::blocking::Client::new();
        let resp = client
          .post("https://oauth2.googleapis.com/revoke")
          .form(&[("token", revoke_token)])
          .send();
        match resp {
          Ok(r) => println!("[OAuth][Disconnect] Revoke status: {}", r.status()),
          Err(e) => eprintln!("[OAuth][Disconnect] Revoke request failed: {}", e),
        }
      } else {
        eprintln!("[OAuth][Disconnect] Failed to parse tokens.json");
      }
    } else {
      eprintln!("[OAuth][Disconnect] Failed to read tokens.json");
    }
    let _ = fs::remove_file(&path);
    println!("[OAuth][Disconnect] Removed tokens file: {:?}", path);
  } else {
    println!("[OAuth][Disconnect] No tokens file found at {:?}", path);
  }

  // Remove MCP credential store files
  let base_dir = if let Ok(dir) = std::env::var("GOOGLE_MCP_CREDENTIALS_DIR") {
    std::path::PathBuf::from(dir)
  } else if let Some(home) = dirs::home_dir() {
    home.join(".google_workspace_mcp").join("credentials")
  } else {
    std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
      .join(".credentials")
  };
  println!("[OAuth][Disconnect] Cleaning MCP credentials in {:?}", base_dir);
  if let Ok(entries) = fs::read_dir(&base_dir) {
    for entry in entries.flatten() {
      if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
        let _ = fs::remove_file(entry.path());
      }
    }
  }
  Ok("Disconnected from Google Suite".to_string())
}

#[tauri::command]
pub fn connect_google_suite(app: tauri::AppHandle) -> Result<String, String> {
  println!("[OAuth][Connect] Starting connect flow...");
  // Load .env from current dir, then try explicit src-tauri paths
  let _ = dotenvy::dotenv();
  {
    use std::path::PathBuf;
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let env_candidates = [
      manifest_dir.join(".env"),
      manifest_dir.join("../.env"),
      manifest_dir.join("../src-tauri/.env"),
    ];
    for path in env_candidates.iter() {
      if path.exists() {
        if dotenvy::from_path(path).is_ok() {
          println!("[OAuth][Connect] Loaded env from {:?}", path);
        }
      }
    }
  }

  // Read secrets from env with explicit debug
  let client_id = match load_env("GOOGLE_CLIENT_ID") {
    Ok(v) => {
      println!("[OAuth][Connect] Loaded GOOGLE_CLIENT_ID (len: {})", v.len());
      v
    }
    Err(e) => {
      eprintln!("[OAuth][Connect] Missing GOOGLE_CLIENT_ID: {}", e);
      return Err(e.to_string());
    }
  };
  
  // Check for client secret with explicit debug
  let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").ok();
  println!("[OAuth][Connect] Environment check - GOOGLE_CLIENT_SECRET: {}", 
    if client_secret.is_some() { "present" } else { "missing" });
  if let Some(ref s) = client_secret { 
    println!("[OAuth][Connect] GOOGLE_CLIENT_SECRET loaded (len: {})", s.len()); 
  }
  
  let oauth_flow = std::env::var("GOOGLE_OAUTH_FLOW").unwrap_or_else(|_| "auto".to_string()).to_lowercase();
  let is_web_flow = oauth_flow == "web" || (oauth_flow == "auto" && client_secret.is_some());
  println!("[OAuth][Connect] Flow decision: oauth_flow={}, has_secret={}, using={}", 
    oauth_flow, client_secret.is_some(), if is_web_flow { "web" } else { "desktop (PKCE)" });

  // Scopes for Google services (broad access for MCP tools)
  let scopes = vec![
    // Gmail
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.labels",
    // Calendar
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
    // Drive
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
    // Docs
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/documents.readonly",
    // Sheets
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    // Slides
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/presentations.readonly",
    // Tasks
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/tasks.readonly",
    // Forms
    "https://www.googleapis.com/auth/forms.body",
    "https://www.googleapis.com/auth/forms.body.readonly",
    "https://www.googleapis.com/auth/forms.responses.readonly",
    // Chat (user-level scopes)
    "https://www.googleapis.com/auth/chat.messages",
    "https://www.googleapis.com/auth/chat.messages.readonly",
    "https://www.googleapis.com/auth/chat.memberships",
    "https://www.googleapis.com/auth/chat.memberships.readonly",
    "https://www.googleapis.com/auth/chat.spaces",
    "https://www.googleapis.com/auth/chat.spaces.readonly",
    // OpenID / user info
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");
  println!("[OAuth][Connect] Total scopes length: {}", scopes.len());

  // Helper to parse a port number from a URL string like http://localhost:3000/path
  let parse_port = |uri: &str| -> Option<u16> {
    let after_scheme = uri.split("://").nth(1)?; // localhost:3000/path
    let host_port = after_scheme.split('/').next()?; // localhost:3000
    host_port.split(':').nth(1)?.parse::<u16>().ok()
  };

  // Start local server for OAuth redirect
  let (listener, redirect_uri) = if is_web_flow {
    let ru = std::env::var("GOOGLE_REDIRECT_URI")
      .unwrap_or_else(|_| "http://localhost:3000/oauth2callback".to_string());
    let port = parse_port(&ru).unwrap_or(3000);
    let l = TcpListener::bind(format!("127.0.0.1:{}", port)).map_err(|e| {
      eprintln!("[OAuth][Connect] Failed to bind configured redirect port {}: {}", port, e);
      e.to_string()
    })?;
    println!("[OAuth][Connect] Redirect URI (web flow): {}", ru);
    (l, ru)
  } else {
    let l = TcpListener::bind("127.0.0.1:0").map_err(|e| {
      eprintln!("[OAuth][Connect] Failed to bind local port: {}", e);
      e.to_string()
    })?;
    l.set_nonblocking(false).map_err(|e| {
      eprintln!("[OAuth][Connect] Failed to set blocking mode: {}", e);
      e.to_string()
    })?;
    let port = l.local_addr().map_err(|e| {
      eprintln!("[OAuth][Connect] Failed to read local addr: {}", e);
      e.to_string()
    })?.port();
    let ru = format!("http://127.0.0.1:{}", port);
    println!("[OAuth][Connect] Redirect URI (desktop flow): {}", ru);
    (l, ru)
  };

  let (code_verifier, code_challenge) = generate_pkce_pair();
  println!("[OAuth][Connect] Generated PKCE pair (verifier: {} chars)", code_verifier.len());

  // Build authorization URL (use v2 endpoint)
  let auth_url = format!(
    "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}&scope={scopes}&access_type=offline&prompt=consent&code_challenge={code_challenge}&code_challenge_method=S256",
  );
  println!("[OAuth][Connect] Opening browser for consent page...");

  open_in_browser(&auth_url).map_err(|e| {
    eprintln!("[OAuth][Connect] Failed to open browser: {}", e);
    e.to_string()
  })?;

  // Accept single connection for redirect
  println!("[OAuth][Connect] Waiting for OAuth redirect on {}...", redirect_uri);
  listener
    .set_nonblocking(false)
    .map_err(|e| {
      eprintln!("[OAuth][Connect] Failed to set blocking mode (second time): {}", e);
      e.to_string()
    })?;

  let (mut stream, _) = listener.accept().map_err(|e| {
    eprintln!("[OAuth][Connect] Failed to accept redirect: {}", e);
    e.to_string()
  })?;
  stream
    .set_read_timeout(Some(Duration::from_secs(120)))
    .ok();

  let mut buffer = [0; 8192];
  let n = stream.read(&mut buffer).map_err(|e| {
    eprintln!("[OAuth][Connect] Failed reading redirect request: {}", e);
    e.to_string()
  })?;
  let req = String::from_utf8_lossy(&buffer[..n]);
  if let Some(first_line) = req.lines().next() { println!("[OAuth][Connect] Redirect first line: {}", first_line); }

  // Parse the first line: GET /?code=... HTTP/1.1
  let first_line = req.lines().next().unwrap_or("");
  let code_opt = first_line
    .split_whitespace()
    .nth(1)
    .and_then(|path| {
      let parts: Vec<&str> = path.split('?').collect();
      if parts.len() < 2 { return None; }
      let query = parts[1];
      for kv in query.split('&') {
        let mut it = kv.splitn(2, '=');
        let k = it.next()?;
        let v = it.next().unwrap_or("");
        if k == "code" { return Some(urlencoding::decode(v).ok()?.to_string()); }
      }
      None
    });

  let code = match code_opt {
    Some(c) => {
      println!("[OAuth][Connect] Received authorization code (len: {})", c.len());
      c
    },
    None => {
      let _ = stream.write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\nContent-Length: 12\r\n\r\nBad Request");
      eprintln!("[OAuth][Connect] Authorization code not found in redirect");
      return Err("Authorization code not found in redirect".into());
    }
  };

  // Respond to browser so user can close the tab
  let _ = stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h2>Google authorization received.</h2><p>You can close this window and return to ArkAngel.</p></body></html>");

  // Exchange code for tokens
  let token_endpoint = "https://oauth2.googleapis.com/token";
  let client = reqwest::blocking::Client::new();
  println!("[OAuth][Connect] Exchanging code for tokens...");

  let mut form = vec![
    ("code", code.as_str()),
    ("client_id", client_id.as_str()),
    ("redirect_uri", redirect_uri.as_str()),
    ("grant_type", "authorization_code"),
    ("code_verifier", code_verifier.as_str()),
  ];
  if is_web_flow {
    if let Some(ref secret) = client_secret {
      form.push(("client_secret", secret.as_str()));
    }
  }

  let resp = match client
    .post(token_endpoint)
    .form(&form)
    .send()
  {
    Ok(r) => {
      println!("[OAuth][Connect] Token endpoint status: {}", r.status());
      r
    },
    Err(e) => {
      eprintln!("[OAuth][Connect] Token request failed: {}", e);
      return Err(e.to_string());
    }
  };

  if !resp.status().is_success() {
    let text = resp.text().unwrap_or_default();
    eprintln!("[OAuth][Connect] Token exchange failed: {}", text);
    // Provide actionable guidance for common error
    if text.contains("client_secret is missing") && !is_web_flow {
      return Err("Token exchange failed: client_secret is missing. Your Google OAuth client likely requires a client secret (Web application). Either set GOOGLE_CLIENT_SECRET and (optionally) GOOGLE_REDIRECT_URI, or switch to a Desktop App OAuth client and set GOOGLE_OAUTH_FLOW=desktop with its client ID.".into());
    }
    return Err(format!("Token exchange failed: {}", text));
  }

  #[derive(Deserialize)]
  struct TokenResp {
    access_token: String,
    expires_in: Option<u64>,
    refresh_token: Option<String>,
    scope: Option<String>,
    token_type: Option<String>,
    id_token: Option<String>,
  }

  let token_resp: TokenResp = resp.json().map_err(|e| {
    eprintln!("[OAuth][Connect] Failed parsing token JSON: {}", e);
    e.to_string()
  })?;

  let tokens = GoogleTokens {
    access_token: token_resp.access_token,
    expires_in: token_resp.expires_in,
    refresh_token: token_resp.refresh_token,
    scope: token_resp.scope,
    token_type: token_resp.token_type,
    id_token: token_resp.id_token,
    obtained_at_ms: std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map_err(|e| e.to_string())?
      .as_millis(),
  };
  println!(
    "[OAuth][Connect] Tokens received (access: {} chars, has_refresh: {}, has_id: {})",
    tokens.access_token.len(),
    tokens.refresh_token.is_some(),
    tokens.id_token.is_some()
  );

  save_tokens(&app, &tokens).map_err(|e| {
    eprintln!("[OAuth][Connect] Failed to save/bridge tokens: {}", e);
    e.to_string()
  })?;
  println!("[OAuth][Connect] Tokens saved and bridged to MCP stores");

  Ok("Google Suite connected successfully".to_string())
} 