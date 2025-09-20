// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod window;
mod pii_scrubber;
mod aws_uploader;
mod google_oauth;
mod file_storage;
mod extract;

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
fn write_conversation_to_file(app: tauri::AppHandle, conversation_data: String, filename: String) -> Result<(), String> {
  use std::fs;
  
  let clean_conversation_data = pii_scrubber::scrub_conversation_json(conversation_data)
    .map_err(|e| format!("Failed to scrub PII: {}", e))?;
  
  // Get the proper app data directory for ArkAngel (consumer-ready)
  let app_data = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("Failed to get app data directory: {}", e))?;
  
  let memory_path = app_data.join("memory");
  
  if !memory_path.exists() {
    fs::create_dir_all(&memory_path)
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
    .map_err(|e| format!("Failed to create file storage: {}", e))?;
  
  storage.upload_file(file_data, filename)
    .map_err(|e| format!("Failed to upload file: {}", e))
}

#[tauri::command]
async fn list_uploaded_files() -> Result<Vec<file_storage::FileInfo>, String> {
  let storage = file_storage::FileStorage::new()
    .map_err(|e| format!("Failed to create file storage: {}", e))?;
  
  storage.list_files()
    .map_err(|e| format!("Failed to list files: {}", e))
}

#[tauri::command]
async fn delete_uploaded_file(file_id: String) -> Result<(), String> {
  let storage = file_storage::FileStorage::new()
    .map_err(|e| format!("Failed to create file storage: {}", e))?;
  
  storage.delete_file(&file_id)
    .map_err(|e| format!("Failed to delete file: {}", e))
}

#[tauri::command]
async fn toggle_file_context(file_id: String) -> Result<file_storage::FileInfo, String> {
  let storage = file_storage::FileStorage::new()
    .map_err(|e| format!("Failed to create file storage: {}", e))?;
  
  storage.toggle_file_context(&file_id)
    .map_err(|e| format!("Failed to toggle file context: {}", e))
}

#[tauri::command]
async fn get_file_context() -> Result<Vec<String>, String> {
  println!("[TAURI] get_file_context called");
  
  let storage = file_storage::FileStorage::new()
    .map_err(|e| format!("Failed to create file storage: {}", e))?;
  
  let files = storage.list_files()
    .map_err(|e| format!("Failed to list files: {}", e))?;
  
  println!("[TAURI] Found {} files in storage", files.len());
  
  let mut context = Vec::new();
  for file_info in files {
    println!("[TAURI] Processing file: {} (type: {}, enabled: {})", 
             file_info.name, file_info.file_type, file_info.is_context_enabled);
    
    if file_info.is_context_enabled {
      // Get the actual file path from storage
      let file_path = storage.get_file_path(&file_info);
      println!("[TAURI] File path: {:?}", file_path);
      
      match extract::extract_text_for_context(&file_path) {
        Ok(formatted_content) => {
          println!("[TAURI] Successfully extracted content for {}", file_info.name);
          println!("[TAURI] Content length: {} chars", formatted_content.len());
          println!("[TAURI] Content preview: {}", &formatted_content[..formatted_content.len().min(200)]);
          context.push(formatted_content);
        }
        Err(e) => {
          println!("[TAURI] Failed to extract content for {}: {}", file_info.name, e);
          context.push(format!("File: {}\nContent:\n[Text extraction failed: {}]", file_info.name, e));
        }
      }
    }
  }
  
  println!("[TAURI] Returning {} context items", context.len());
  Ok(context)
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
            list_uploaded_files,
            delete_uploaded_file,
            toggle_file_context,
            get_file_context
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

            // Skip build step for now - sidecar should be pre-built
            println!("[sidecar] Skipping build step - using pre-built sidecar");

            // Verify the server.js file exists
            if !script_path.exists() {
              return Err(format!("Sidecar server file not found: {:?}", script_path).into());
            }
            println!("[sidecar] Server file verified: {:?}", script_path);

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
        });

    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_plugin_macos_permissions::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
