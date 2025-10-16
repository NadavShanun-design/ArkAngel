// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod window;
mod pii_scrubber;
mod aws_uploader;
mod google_oauth;
mod file_storage;

use std::process::{Command as StdCommand, Stdio, Child};
use std::sync::Mutex;
use std::thread;
use std::io::{BufRead, BufReader};
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn set_window_height(window: tauri::WebviewWindow, height: u32) -> Result<(), String> {
  use tauri::{LogicalSize, Size};
  
  let new_size = LogicalSize::new(700.0, height as f64);
  
  match window.set_size(Size::Logical(new_size)) {
    Ok(_) => {
      if let Err(e) = window::position_window_top_center(&window, 54) {
        eprintln!("Failed to reposition window: {}", e);
      }
      Ok(())
    }
    Err(e) => Err(format!("Failed to resize window: {}", e))
  }
}

#[tauri::command]
fn write_conversation_to_file(conversation_data: String, filename: String) -> Result<(), String> {
  use std::fs;
  use std::path::Path;
  
  let clean_conversation_data = pii_scrubber::scrub_conversation_json(conversation_data)
    .map_err(|e| format!("Failed to scrub PII: {}", e))?;
  
  let project_dir = Path::new("C:\\Users\\parad\\Downloads\\pluely-master2");
  
  let memory_path = project_dir.join("memory");
  
  if !memory_path.exists() {
    fs::create_dir(&memory_path)
      .map_err(|e| format!("Failed to create memory directory: {}", e))?;
  }
  
  let file_path = memory_path.join(filename);
  
  fs::write(&file_path, clean_conversation_data)
    .map_err(|e| format!("Failed to write file: {}", e))?;
  
  println!("Clean conversation written to: {:?}", file_path);
  Ok(())
}

#[tauri::command]
fn trigger_aws_upload() -> Result<String, String> {
  let uploader = aws_uploader::AwsUploader::new()
    .map_err(|e| format!("Failed to create AWS uploader: {}", e))?;
  
  match uploader.scan_and_upload() {
    Ok(_) => Ok("AWS upload scan completed successfully".to_string()),
    Err(e) => Err(format!("AWS upload scan failed: {}", e))
  }
}

// File storage commands
#[tauri::command]
async fn upload_file(file_data: Vec<u8>, filename: String) -> Result<file_storage::FileInfo, String> {
    let storage = file_storage::FileStorage::new()
        .map_err(|e| format!("Failed to initialize file storage: {}", e))?;
    
    storage.upload_file(file_data, filename)
        .map_err(|e| format!("Failed to upload file: {}", e))
}

#[tauri::command]
async fn upload_file_from_path(
    file_path: String,
    filename: String,
) -> Result<file_storage::FileInfo, String> {
    println!(
        "[Backend] upload_file_from_path command called: path={}, filename={}",
        file_path, filename
    );

    let storage = file_storage::FileStorage::new().map_err(|e| {
        let error_msg = format!("Failed to initialize file storage: {}", e);
        println!("[Backend] Error initializing storage: {}", error_msg);
        error_msg
    })?;

    // Validate input
    if file_path.is_empty() {
        return Err("File path is empty".to_string());
    }
    if filename.is_empty() {
        return Err("File name is empty".to_string());
    }

    // Check if file exists
    if !std::path::Path::new(&file_path).exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    // Determine file type from extension
    let file_type = file_storage::FileStorage::get_file_type_from_name(&filename);
    
    // Store file with content extraction
    let result = storage
        .store_file_from_path_robust(&file_path, &filename, &file_type)
        .map_err(|e| {
            println!("[Backend] Upload failed: {}", e);
            format!("Failed to upload file: {}", e)
        })?;

    println!(
        "[Backend] Upload successful: {} ({} bytes)",
        result.name, result.size
    );
    Ok(result)
}

#[tauri::command]
async fn list_uploaded_files() -> Result<Vec<file_storage::FileInfo>, String> {
    let storage = file_storage::FileStorage::new()
        .map_err(|e| format!("Failed to initialize file storage: {}", e))?;
    
    storage.list_files()
        .map_err(|e| format!("Failed to list files: {}", e))
}

#[tauri::command]
async fn delete_uploaded_file(file_id: String) -> Result<(), String> {
    let storage = file_storage::FileStorage::new()
        .map_err(|e| format!("Failed to initialize file storage: {}", e))?;
    
    storage.delete_file(&file_id)
        .map_err(|e| format!("Failed to delete file: {}", e))
}

#[tauri::command]
async fn toggle_file_context(file_id: String) -> Result<file_storage::FileInfo, String> {
    let storage = file_storage::FileStorage::new()
        .map_err(|e| format!("Failed to initialize file storage: {}", e))?;
    
    storage.toggle_context(&file_id)
        .map_err(|e| format!("Failed to toggle file context: {}", e))
}

#[tauri::command]
async fn get_file_context() -> Result<Vec<String>, String> {
    let storage = file_storage::FileStorage::new()
        .map_err(|e| format!("Failed to initialize file storage: {}", e))?;
    
    storage.get_context_content()
        .map_err(|e| format!("Failed to get file context: {}", e))
}

#[tauri::command]
async fn get_optimized_file_context() -> Result<Vec<String>, String> {
    let storage = file_storage::FileStorage::new()
        .map_err(|e| format!("Failed to initialize file storage: {}", e))?;
    
    storage.get_optimized_context()
        .map_err(|e| format!("Failed to get optimized file context: {}", e))
}

#[tauri::command]
async fn extract_file_content(file_id: String) -> Result<String, String> {
    let storage = file_storage::FileStorage::new()
        .map_err(|e| format!("Failed to initialize file storage: {}", e))?;
    
    storage.extract_file_content(&file_id)
        .map_err(|e| format!("Failed to extract file content: {}", e))
}

#[tauri::command]
async fn wipe_uploaded_files() -> Result<(), String> {
  let storage = file_storage::FileStorage::new()
    .map_err(|e| format!("Failed to initialize file storage: {}", e))?;
  storage.wipe_all()
    .map_err(|e| format!("Failed to wipe uploaded files: {}", e))
}

// Conversation-linked uploads management
#[tauri::command]
async fn delete_files_by_conversation(conversation_id: String) -> Result<usize, String> {
  let storage = file_storage::FileStorage::new()
    .map_err(|e| format!("Failed to initialize file storage: {}", e))?;
  storage.delete_files_by_conversation(&conversation_id)
    .map_err(|e| format!("Failed to delete files for conversation: {}", e))
}

#[tauri::command]
async fn count_files_by_conversation(conversation_id: String) -> Result<usize, String> {
  let storage = file_storage::FileStorage::new()
    .map_err(|e| format!("Failed to initialize file storage: {}", e))?;
  storage.count_files_by_conversation(&conversation_id)
    .map_err(|e| format!("Failed to count files for conversation: {}", e))
}

#[tauri::command]
async fn link_enabled_files_to_conversation(conversation_id: String) -> Result<usize, String> {
  let storage = file_storage::FileStorage::new()
    .map_err(|e| format!("Failed to initialize file storage: {}", e))?;
  storage.link_enabled_files_to_conversation(&conversation_id)
    .map_err(|e| format!("Failed to link files to conversation: {}", e))
}

// Authentication window commands
#[tauri::command]
async fn open_auth_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri::{LogicalSize, LogicalPosition, Size, Position};
    
    let auth_window = tauri::WebviewWindowBuilder::new(
        &app_handle,
        "auth",
        tauri::WebviewUrl::App("/auth".into())
    )
    .title("ArkAngel - Sign In")
    .inner_size(480.0, 640.0)
    .min_inner_size(480.0, 640.0)
    .max_inner_size(480.0, 640.0)
    .resizable(false)
    .decorations(true)
    .always_on_top(true)
    .center()
    .build()
    .map_err(|e| format!("Failed to create auth window: {}", e))?;

    // Center the window on the screen
    if let Err(e) = auth_window.center() {
        eprintln!("Failed to center auth window: {}", e);
    }

    Ok(())
}

#[tauri::command]
async fn close_auth_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(auth_window) = app_handle.get_webview_window("auth") {
        auth_window.close().map_err(|e| format!("Failed to close auth window: {}", e))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet, 
            get_app_version,
            set_window_height,
            write_conversation_to_file,
            trigger_aws_upload,
            google_oauth::connect_google_suite,
            google_oauth::disconnect_google_suite,
            google_oauth::is_google_connected,
            upload_file,
            upload_file_from_path,
            list_uploaded_files,
            delete_uploaded_file,
            toggle_file_context,
            get_file_context,
            get_optimized_file_context,
            extract_file_content,
            wipe_uploaded_files,
            delete_files_by_conversation,
            count_files_by_conversation,
            link_enabled_files_to_conversation,
            open_auth_window,
            close_auth_window,
        ])
        .setup(|app| {
            // Make a shared place to store the sidecar child
            app.manage(Mutex::new(None::<Child>));

            // Setup main window positioning
            window::setup_main_window(app).expect("Failed to setup main window");

            // Start AWS background uploader (non-blocking)
            if let Err(e) = aws_uploader::AwsUploader::start_background_uploader() {
                eprintln!("Failed to start AWS uploader: {}", e);
            } else {
                println!("AWS background uploader started successfully");
            }

            // Absolute path to sidecar script based on src-tauri dir
            let script_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../sidecar/dist/server.js");
            let sidecar_cwd = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../sidecar");
            println!(
              "[sidecar] Preparing sidecar. cwd: {:?} script: {:?}",
              sidecar_cwd, script_path
            );

            // If port already in use, skip building/spawning the sidecar
            let port_in_use = std::net::TcpStream::connect(("127.0.0.1", 8765)).is_ok();
            if port_in_use {
              println!("[sidecar] Port 8765 already in use; skipping sidecar spawn.");
              return Ok(());
            }

            // Always build sidecar to pick up latest changes during dev
            println!("[sidecar] Running npm run build...");
            let npm_cmd = if cfg!(target_os = "windows") { "npm.cmd" } else { "npm" };

            // Ensure dependencies are installed (idempotent)
            let install_status = StdCommand::new(npm_cmd)
              .current_dir(&sidecar_cwd)
              .args(["ci", "--silent"]) // prefer clean, reproducible install
              .status()
              .map_err(|e| format!("Failed to run sidecar install: {}", e))?;
            if !install_status.success() {
              eprintln!("[sidecar] npm ci failed; falling back to npm install...");
              let fallback_install = StdCommand::new(npm_cmd)
                .current_dir(&sidecar_cwd)
                .args(["install", "--silent"]) // fallback for environments without lockfile compatibility
                .status()
                .map_err(|e| format!("Failed to run sidecar install fallback: {}", e))?;
              if !fallback_install.success() {
                return Err("Sidecar dependency installation failed.".into());
              }
            }

            // Build the sidecar TypeScript -> JavaScript
            let build_status = StdCommand::new(npm_cmd)
              .current_dir(&sidecar_cwd)
              .args(["run", "build", "--silent"])
              .status()
              .map_err(|e| format!("Failed to run sidecar build: {}", e))?;
            if !build_status.success() {
              return Err("Sidecar build failed. Try running `npm --prefix sidecar ci && npm --prefix sidecar run build`.".into());
            }
            println!("[sidecar] Build completed.");

            // Spawn sidecar
            println!("[sidecar] Spawning Node...");
            let mut child = StdCommand::new("node")
              .current_dir(&sidecar_cwd)
              .arg(&script_path)
              .env("AGENT_PORT", "8765")
              .stdout(Stdio::piped())
              .stderr(Stdio::piped())
              .spawn()
              .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

            // Pipe stdout
            if let Some(stdout) = child.stdout.take() {
              thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                  if let Ok(l) = line {
                    println!("[sidecar][stdout] {}", l);
                  }
                }
              });
            }
            // Pipe stderr
            if let Some(stderr) = child.stderr.take() {
              thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                  if let Ok(l) = line {
                    eprintln!("[sidecar][stderr] {}", l);
                  }
                }
              });
            }

            // Store handle for later cleanup (ensure guard drops before state)
            {
              let state_mutex = app.state::<Mutex<Option<Child>>>();
              let mut guard = match state_mutex.lock() {
                Ok(g) => g,
                Err(_) => return Err("Failed to lock sidecar state mutex".into()),
              };
              *guard = Some(child);
            }

            Ok(())
        })
        .on_window_event(|w, e| {
          if let tauri::WindowEvent::CloseRequested { api, .. } = e {
            // Only prevent close and exit for the main window
            // Allow auth window and other windows to close normally
            if w.label() != "auth" {
              api.prevent_close();
              // Attempt to kill sidecar gently
              let app_handle = w.app_handle();
              if let Some(mutex) = app_handle.try_state::<Mutex<Option<Child>>>() {
                if let Ok(mut guard) = mutex.lock() {
                  if let Some(mut child) = guard.take() {
                    let _ = child.kill();
                  }
                }
              }
              std::process::exit(0);
            }
          }
        });

    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_plugin_macos_permissions::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
