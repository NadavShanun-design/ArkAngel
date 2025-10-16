use anyhow::{anyhow, Context, Result};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::{fs, io::Read, path::{Path, PathBuf}, thread, time::Duration, sync::mpsc::channel, collections::HashSet, sync::Mutex};
use walkdir::WalkDir;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, event::EventKind};

// -------- config --------

#[derive(Deserialize, Debug)]
pub struct AwsConfig {
    pub api_url: String,         // e.g., https://<api-id>.execute-api.us-west-2.amazonaws.com/ingest/new
    pub device_id: String,       // e.g., "dev001"
    pub watch_dir: String,       // e.g., ".\\memory"
    pub scan_interval_secs: Option<u64>,
    pub concurrency: Option<usize>,
}

impl AwsConfig {
    pub fn load() -> Result<Self> {
        // Try to find config.toml in multiple locations
        let config_paths = vec![
            "config.toml",  // Current directory
            "../config.toml",  // Parent directory (for when running from src-tauri)
            "../../config.toml",  // Two levels up (fallback)
        ];
        
        let mut config_content = None;
        let mut found_path = None;
        
        for path in &config_paths {
            if let Ok(content) = fs::read_to_string(path) {
                config_content = Some(content);
                found_path = Some(*path);
                println!("🔍 AWS Config: Found config at {}", path);
                break;
            }
        }
        
        let text = config_content.ok_or_else(|| anyhow!("config.toml not found in any expected location"))?;
        let mut cfg: AwsConfig = toml::from_str(&text).context("parsing config.toml")?;
        
        // Resolve relative paths to absolute paths
        if !cfg.watch_dir.starts_with("C:") && !cfg.watch_dir.starts_with("/") {
            // Always resolve watch_dir relative to project root (one level up from where config.toml was found)
            let project_root = match found_path {
                Some("config.toml") => std::env::current_dir()?.join(".."),
                Some("../config.toml") => std::env::current_dir()?.join("..").join(".."),
                Some("../../config.toml") => std::env::current_dir()?.join("..").join("..").join(".."),
                _ => std::env::current_dir()?.join(".."),
            };
            
            // Resolve the watch_dir relative to the project root
            let resolved_path = project_root.join(&cfg.watch_dir);
            
            // Canonicalize the path if possible, otherwise use the joined path
            let final_path = if let Ok(canonical) = resolved_path.canonicalize() {
                canonical
            } else {
                resolved_path
            };
            
            cfg.watch_dir = final_path.to_string_lossy().to_string();
            println!("🔍 AWS Config: Project root: {}", project_root.display());
            println!("🔍 AWS Config: Resolved watch_dir to: {}", cfg.watch_dir);
        }
        
        if cfg.scan_interval_secs.is_none() { cfg.scan_interval_secs = Some(60); }
        if cfg.concurrency.is_none() { cfg.concurrency = Some(2); }
        Ok(cfg)
    }
}

// -------- presign request/response contracts --------

#[derive(Serialize)]
struct PresignReq<'a> {
    #[serde(rename = "deviceId")]
    device_id: &'a str,
    filename: &'a str,
}

#[derive(Deserialize, Debug)]
struct PresignResp {
    url: String,
    key: String,
}

// -------- helpers --------

fn is_complete_json(path: &Path) -> bool {
    // Only pick *.json files (not *.tmp or already-synced files)
    if path.extension().and_then(|e| e.to_str()) != Some("json") {
        return false;
    }
    if path.file_name().and_then(|n| n.to_str()).map(|s| s.ends_with(".synced")).unwrap_or(false) {
        return false;
    }
    true
}

fn mark_synced(path: &Path) -> Result<()> {
    let mut new_path = path.to_path_buf();
    // change foo.json -> foo.json.synced
    let new_name = format!(
        "{}.synced",
        path.file_name().unwrap().to_string_lossy()
    );
    new_path.set_file_name(new_name);
    // prefer atomic rename; fallback to copy+delete if cross-device
    if fs::rename(path, &new_path).is_err() {
        fs::copy(path, &new_path)?;
        fs::remove_file(path)?;
    }
    Ok(())
}

fn read_all_bytes(path: &Path) -> Result<Vec<u8>> {
    // If the producer writes atomically (tmp+rename), this just works.
    // If not, you can add a small sleep or check size-stability.
    let mut f = fs::File::open(path)?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf)?;
    Ok(buf)
}

// -------- core upload logic --------

fn presign(client: &Client, api_url: &str, device_id: &str, filename: &str) -> Result<PresignResp> {
    let body = PresignReq { device_id, filename };
    let resp = client
        .post(api_url)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .context("calling presign endpoint")?
        .error_for_status()
        .context("non-200 from presign endpoint")?
        .json::<PresignResp>()
        .context("decoding presign response")?;
    Ok(resp)
}

fn upload_with_put(client: &Client, put_url: &str, bytes: Vec<u8>) -> Result<()> {
    let r = client
        .put(put_url)
        .header("content-type", "application/json")
        .body(bytes)
        .send()
        .context("PUT to presigned URL")?;
    if !r.status().is_success() {
        return Err(anyhow!("upload failed with status {}", r.status()));
    }
    Ok(())
}

// Exponential backoff helper
fn retry<F>(mut f: F, attempts: usize, base_delay_ms: u64) -> Result<()>
where
    F: FnMut() -> Result<()>,
{
    let mut delay = base_delay_ms;
    for i in 0..attempts {
        match f() {
            Ok(_) => return Ok(()),
            Err(e) => {
                eprintln!("attempt {}/{} failed: {e:?}", i + 1, attempts);
                if i + 1 == attempts { break; }
                thread::sleep(Duration::from_millis(delay));
                delay = (delay as f64 * 1.8).min(30_000.0) as u64; // cap ~30s
            }
        }
    }
    Err(anyhow!("all {} attempts failed", attempts))
}

fn process_file(client: &Client, cfg: &AwsConfig, path: &Path) -> Result<()> {
    let filename = path.file_name().unwrap().to_string_lossy().to_string();

    // 1) presign with retry logic
    let presigned = {
        let mut last_error: Option<anyhow::Error> = None;
        let mut result: Option<PresignResp> = None;
        
        for delay in [500, 1200, 2500] {
            match presign(client, &cfg.api_url, &cfg.device_id, &filename) {
                Ok(p) => { 
                    result = Some(p); 
                    break; 
                }
                Err(e) => { 
                    last_error = Some(e); 
                    thread::sleep(Duration::from_millis(delay)); 
                }
            }
        }
        
        result.ok_or_else(|| last_error.unwrap_or_else(|| anyhow!("Presign failed after all attempts")))
    }?;

    // 2) read bytes
    let bytes = read_all_bytes(path).context("reading file before upload")?;

    // 3) upload (presigned PUT)
    retry(
        || {
            upload_with_put(client, &presigned.url, bytes.clone())
        },
        5,   // attempts
        700, // base delay ms
    )?;

    // 4) mark local file as synced
    mark_synced(path)?;

    println!("✅ uploaded: {}  →  s3://arkangel-json-ingest-prod/{}", filename, presigned.key);
    Ok(())
}

// -------- public interface --------

pub struct AwsUploader {
    config: AwsConfig,
    client: Client,
}

impl AwsUploader {
    pub fn new() -> Result<Self> {
        let config = AwsConfig::load()?;
        fs::create_dir_all(&config.watch_dir).ok();

        // HTTP client with sensible timeouts
        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .context("building http client")?;

        Ok(Self { config, client })
    }

    pub fn scan_and_upload(&self) -> Result<()> {
        println!("🔍 AWS Uploader: Starting scan of directory: {}", self.config.watch_dir);
        
        // gather candidate files
        let mut files: Vec<PathBuf> = Vec::new();
        for entry in WalkDir::new(&self.config.watch_dir).max_depth(1) {
            let entry = match entry { Ok(e) => e, Err(_) => continue };
            let p = entry.path().to_path_buf();
            if p.is_file() && is_complete_json(&p) {
                println!("🔍 AWS Uploader: Found file: {}", p.display());
                files.push(p);
            }
        }

        if !files.is_empty() {
            println!("🔍 AWS Uploader: Found {} file(s) to upload", files.len());
        } else {
            println!("🔍 AWS Uploader: No files found to upload");
        }

        // process files sequentially for now (can be made parallel later)
        for p in files {
            // Check if file still exists and is still a valid JSON (not already processed)
            if p.exists() && is_complete_json(&p) {
                if let Err(e) = process_file(&self.client, &self.config, &p) {
                    eprintln!("⚠️  failed processing {}: {e:?}", p.display());
                }
            } else {
                println!("🔍 AWS Uploader: Skipping file (no longer valid): {}", p.display());
            }
        }

        Ok(())
    }

    pub fn start_background_uploader() -> Result<()> {
        let uploader = AwsUploader::new()?;
        let scan_secs = uploader.config.scan_interval_secs.unwrap_or(60);
        let watch_dir = uploader.config.watch_dir.clone();
        let api_url = uploader.config.api_url.clone();
        let device_id = uploader.config.device_id.clone();
        let client = uploader.client.clone();

        // Start file watcher thread
        std::thread::spawn(move || {
            println!("🔍 AWS Uploader: File watcher thread started");
            
            // Track currently processing files to prevent duplicates
            let processing_files: Mutex<HashSet<PathBuf>> = Mutex::new(HashSet::new());
            
            // Create file watcher
            let (tx, rx) = channel();
            let mut watcher: RecommendedWatcher = match notify::recommended_watcher(move |res| {
                let _ = tx.send(res);
            }) {
                Ok(w) => w,
                Err(e) => {
                    eprintln!("⚠️  Failed to create file watcher: {}", e);
                    return;
                }
            };
            
            // Watch the memory directory
            if let Err(e) = watcher.watch(Path::new(&watch_dir), RecursiveMode::NonRecursive) {
                eprintln!("⚠️  Failed to watch directory {}: {}", watch_dir, e);
                return;
            }
            
            println!("🔍 AWS Uploader: Watching directory: {}", watch_dir);
            
            // Event loop for file changes
            loop {
                match rx.recv() {
                    Ok(Ok(event)) => {
                        match event.kind {
                            EventKind::Create(_) | EventKind::Modify(_) => {
                                for path in event.paths {
                                    if is_complete_json(&path) {
                                        let path_buf = PathBuf::from(&path);
                                        
                                        // Check if file is already being processed
                                        {
                                            let mut processing = processing_files.lock().unwrap();
                                            if processing.contains(&path_buf) {
                                                println!("🔍 AWS Uploader: Skipping already processing file: {}", path_buf.display());
                                                continue;
                                            }
                                            // Mark file as being processed
                                            processing.insert(path_buf.clone());
                                        }
                                        
                                        println!("🔍 AWS Uploader: File event detected: {}", path_buf.display());
                                        
                                        // Small delay to ensure file is fully written
                                        thread::sleep(Duration::from_millis(150));
                                        
                                        // Double-check file still exists and is valid before processing
                                        if !path_buf.exists() || !is_complete_json(&path_buf) {
                                            println!("🔍 AWS Uploader: File no longer valid, skipping: {}", path_buf.display());
                                            // Remove from processing set
                                            {
                                                let mut processing = processing_files.lock().unwrap();
                                                processing.remove(&path_buf);
                                            }
                                            continue;
                                        }
                                        
                                        // Create temporary config for this file processing
                                        let temp_config = AwsConfig {
                                            api_url: api_url.clone(),
                                            device_id: device_id.clone(),
                                            watch_dir: watch_dir.clone(),
                                            scan_interval_secs: Some(scan_secs),
                                            concurrency: Some(2),
                                        };
                                        
                                        // Process the file
                                        if let Err(e) = process_file(&client, &temp_config, &path_buf) {
                                            eprintln!("⚠️  Event-triggered upload failed: {}", e);
                                        }
                                        
                                        // Remove file from processing set
                                        {
                                            let mut processing = processing_files.lock().unwrap();
                                            processing.remove(&path_buf);
                                        }
                                    }
                                }
                            }
                            _ => {} // Ignore other events
                        }
                    }
                    Ok(Err(e)) => eprintln!("⚠️  File watcher error: {}", e),
                    Err(_) => {
                        eprintln!("⚠️  File watcher channel closed");
                        break;
                    }
                }
            }
        });

        // Start periodic scan thread (fallback)
        std::thread::spawn(move || {
            println!("🔍 AWS Uploader: Background scan thread started, scanning every {} seconds", scan_secs);
            loop {
                println!("🔍 AWS Uploader: Starting scan cycle...");
                if let Err(e) = uploader.scan_and_upload() {
                    eprintln!("⚠️  AWS Uploader error: {e:?}");
                }
                println!("🔍 AWS Uploader: Scan cycle completed, sleeping for {} seconds", scan_secs);
                thread::sleep(Duration::from_secs(scan_secs));
            }
        });

        Ok(())
    }
}
