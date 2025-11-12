// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod window;
mod google_oauth;
mod file_storage;
mod transcript_manager;
mod training_data_manager;
mod agent_manager;
mod rag_system_manager;
mod simple_rag_manager;  // NEW: Fast RAG without embeddings
mod openai_rag_manager;  // NEW: Production RAG with OpenAI embeddings
mod uitars_agent;
mod secure_storage;  // NEW: Secure API key storage
mod logger;  // NEW: Centralized logging infrastructure
mod whisper_local;  // NEW: On-device Whisper transcription (pre-built binary)
mod screenshot_manager;  // NEW: Screenshot capture and storage
mod vlm_captioner;  // NEW: Vision Language Model integration
mod employee_tracker;  // NEW: Employee monitoring and software usage tracking

use std::process::{Command as StdCommand, Stdio, Child};
use std::sync::{Arc, Mutex};
use std::thread;
use std::io::{BufRead, BufReader};
use tauri::Manager;
use tauri::Emitter;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Test command to verify events work
#[tauri::command]
async fn test_event_system(app: tauri::AppHandle) -> Result<String, String> {
    println!("🧪 [TEST] Testing event system...");

    // Try emitting a test event
    match app.emit("test_event", "Hello from Rust!") {
        Ok(_) => {
            println!("✅ [TEST] Event emitted successfully!");
            Ok("Event system working! Check frontend console.".to_string())
        },
        Err(e) => {
            eprintln!("❌ [TEST] Event emission failed: {}", e);
            Err(format!("Event emission failed: {}", e))
        }
    }
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

  // Determine project root directory
  let project_dir = std::env::current_dir()
    .unwrap_or_else(|_| Path::new(".").to_path_buf());

  let memory_path = project_dir.join("memory");

  if !memory_path.exists() {
    fs::create_dir(&memory_path)
      .map_err(|e| format!("Failed to create memory directory: {}", e))?;
  }

  let file_path = memory_path.join(filename);

  fs::write(&file_path, conversation_data)
    .map_err(|e| format!("Failed to write file: {}", e))?;

  println!("Conversation written to: {:?}", file_path);
  Ok(())
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
    // Check if auth window already exists
    if let Some(auth_window) = app_handle.get_webview_window("auth") {
        // Try to check if window is actually visible/valid
        match auth_window.is_visible() {
            Ok(true) => {
                // Window exists and is visible, just bring it to front
                println!("[Auth] Window already open, bringing to front");
                auth_window.set_focus().map_err(|e| format!("Failed to focus auth window: {}", e))?;
                return Ok(());
            }
            Ok(false) => {
                // Window exists but is hidden, show it
                println!("[Auth] Window hidden, showing it");
                auth_window.show().map_err(|e| format!("Failed to show auth window: {}", e))?;
                auth_window.set_focus().map_err(|e| format!("Failed to focus auth window: {}", e))?;
                return Ok(());
            }
            Err(_) => {
                // Window reference is stale, close it and create new one
                println!("[Auth] Window reference stale, recreating");
                let _ = auth_window.close();
            }
        }
    }

    // Create new auth window
    println!("[Auth] Creating new auth window");
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
        eprintln!("[Auth] Failed to center auth window: {}", e);
    }

    println!("[Auth] Auth window created successfully");
    Ok(())
}

#[tauri::command]
async fn close_auth_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(auth_window) = app_handle.get_webview_window("auth") {
        auth_window.close().map_err(|e| format!("Failed to close auth window: {}", e))?;
    }
    Ok(())
}

// Settings window commands
#[tauri::command]
async fn open_settings_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Check if settings window already exists
    if let Some(settings_window) = app_handle.get_webview_window("settings") {
        // Try to check if window is actually visible/valid
        match settings_window.is_visible() {
            Ok(true) => {
                // Window exists and is visible, just bring it to front
                println!("[Settings] Window already open, bringing to front");
                settings_window.set_focus().map_err(|e| format!("Failed to focus settings window: {}", e))?;
                settings_window.set_always_on_top(true).ok();
                // Immediately disable always on top after bringing to front
                settings_window.set_always_on_top(false).ok();
                return Ok(());
            }
            Ok(false) => {
                // Window exists but is hidden, show it
                println!("[Settings] Window hidden, showing it");
                settings_window.show().map_err(|e| format!("Failed to show settings window: {}", e))?;
                settings_window.set_focus().map_err(|e| format!("Failed to focus settings window: {}", e))?;
                return Ok(());
            }
            Err(_) => {
                // Window reference is stale, close it and create new one
                println!("[Settings] Window reference stale, recreating");
                let _ = settings_window.close();
            }
        }
    }

    // Create new settings window
    println!("[Settings] Creating new settings window");
    let settings_window = tauri::WebviewWindowBuilder::new(
        &app_handle,
        "settings",
        tauri::WebviewUrl::App("/settings".into())
    )
    .title("ArkAngel - Advanced Settings")
    .inner_size(1024.0, 768.0)
    .min_inner_size(800.0, 600.0)
    .resizable(true)
    .decorations(true)
    .center()
    .build()
    .map_err(|e| format!("Failed to create settings window: {}", e))?;

    // Center the window on the screen
    if let Err(e) = settings_window.center() {
        eprintln!("[Settings] Failed to center settings window: {}", e);
    }

    println!("[Settings] Settings window created successfully");
    Ok(())
}

#[tauri::command]
async fn close_settings_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(settings_window) = app_handle.get_webview_window("settings") {
        settings_window.close().map_err(|e| format!("Failed to close settings window: {}", e))?;
    }
    Ok(())
}

// Screenshot capture commands
// Note: xcap is synchronous, so we use spawn_blocking to avoid blocking the main thread
#[tauri::command]
async fn capture_screenshot() -> Result<screenshot_manager::ScreenshotInfo, String> {
    tokio::task::spawn_blocking(|| {
        screenshot_manager::capture_primary_monitor()
    })
    .await
    .map_err(|e| format!("Screenshot task failed: {}", e))?
}

#[tauri::command]
async fn capture_screenshot_with_caption(ollama_url: Option<String>) -> Result<screenshot_manager::ScreenshotInfo, String> {
    // First capture screenshot in blocking task
    let screenshot_info = tokio::task::spawn_blocking(|| {
        screenshot_manager::capture_primary_monitor()
    })
    .await
    .map_err(|e| format!("Screenshot task failed: {}", e))??;

    // Then try to add caption (non-blocking if it fails)
    match screenshot_manager::add_caption_to_screenshot(&screenshot_info.id, ollama_url.as_deref()).await {
        Ok(updated_info) => {
            // Update John Doe employee tracking with the new screenshot and caption
            if let Some(caption) = &updated_info.caption {
                let _ = employee_tracker::update_john_doe_with_screenshot(
                    &updated_info.id,
                    &updated_info.timestamp,
                    caption
                ).await;
            }
            Ok(updated_info)
        },
        Err(e) => {
            eprintln!("[Screenshot] Caption generation failed (returning screenshot without caption): {}", e);
            Ok(screenshot_info) // Return screenshot without caption instead of failing
        }
    }
}

#[tauri::command]
async fn get_all_screenshots() -> Result<Vec<screenshot_manager::ScreenshotInfo>, String> {
    screenshot_manager::get_all_screenshots()
}

#[tauri::command]
async fn delete_screenshot(screenshot_id: String) -> Result<(), String> {
    screenshot_manager::delete_screenshot(&screenshot_id)
}

#[tauri::command]
async fn get_screenshot_by_id(screenshot_id: String) -> Result<screenshot_manager::ScreenshotInfo, String> {
    screenshot_manager::get_screenshot_by_id(&screenshot_id)
}

// VLM and training integration command
#[derive(serde::Serialize)]
struct AddToTrainingResult {
    screenshot_id: String,
    caption: String,
    tokens_used: u32,
    cost: f64,
}

#[tauri::command]
async fn add_screenshot_to_training(
    screenshot_id: String,
    api_key: String,
    provider: Option<String>,
) -> Result<AddToTrainingResult, String> {
    println!("[AddToTraining] Starting for screenshot: {}", screenshot_id);

    // Get screenshot info
    let screenshot = screenshot_manager::get_screenshot_by_id(&screenshot_id)?;

    // Generate caption using VLM (default to GPT-4o-mini)
    let caption_result = match provider.as_deref() {
        Some("claude") => vlm_captioner::caption_with_claude(&screenshot.file_path, &api_key).await?,
        _ => vlm_captioner::caption_with_gpt4o_mini(&screenshot.file_path, &api_key).await?,
    };

    println!("[AddToTraining] Caption generated: {} chars", caption_result.caption.len());

    // Add to training data system
    let training_manager = training_data_manager::TrainingDataManager::new()
        .map_err(|e| format!("Failed to initialize training manager: {}", e))?;

    training_manager.add_screenshot_to_training(
        screenshot_id.clone(),
        screenshot.file_path.clone(),
        caption_result.caption.clone(),
        screenshot.width,
        screenshot.height,
        screenshot.timestamp.clone(),
    ).map_err(|e| format!("Failed to save to training data: {}", e))?;

    // Mark screenshot as added to training
    screenshot_manager::mark_as_added_to_training(&screenshot_id)?;

    println!("[AddToTraining] Complete! Cost: ${:.6}", caption_result.cost);

    Ok(AddToTrainingResult {
        screenshot_id,
        caption: caption_result.caption,
        tokens_used: caption_result.tokens_used,
        cost: caption_result.cost,
    })
}

#[tauri::command]
async fn generate_caption_with_ollama(
    screenshot_id: String,
    ollama_url: Option<String>,
    model: Option<String>,
) -> Result<AddToTrainingResult, String> {
    println!("[GenerateCaption] Starting Ollama caption for screenshot: {}", screenshot_id);

    // Get screenshot info
    let screenshot = screenshot_manager::get_screenshot_by_id(&screenshot_id)?;

    // Generate caption using Ollama VLM (locally hosted Stream)
    let caption_result = vlm_captioner::caption_with_ollama(
        &screenshot.file_path,
        ollama_url.as_deref(),
        model.as_deref(),
    ).await?;

    println!("[GenerateCaption] Caption generated: {} chars", caption_result.caption.len());

    // Update screenshot with caption
    screenshot_manager::update_screenshot_caption(&screenshot_id, &caption_result.caption)
        .map_err(|e| format!("Failed to update screenshot caption: {}", e))?;

    // Update John Doe employee tracking with the new caption
    let _ = employee_tracker::update_john_doe_with_screenshot(
        &screenshot_id,
        &screenshot.timestamp,
        &caption_result.caption
    ).await;

    Ok(AddToTrainingResult {
        screenshot_id: screenshot_id.clone(),
        caption: caption_result.caption.clone(),
        tokens_used: caption_result.tokens_used,
        cost: caption_result.cost,
    })
}

#[tauri::command]
async fn add_screenshot_to_training_with_caption(
    screenshot_id: String,
    caption: String,
) -> Result<(), String> {
    println!("[AddToTraining] Adding screenshot {} to training with existing caption", screenshot_id);

    // Get screenshot info
    let screenshot = screenshot_manager::get_screenshot_by_id(&screenshot_id)?;

    // Add to training data system
    let training_manager = training_data_manager::TrainingDataManager::new()
        .map_err(|e| format!("Failed to initialize training manager: {}", e))?;

    training_manager.add_screenshot_to_training(
        screenshot_id.clone(),
        screenshot.file_path.clone(),
        caption.clone(),
        screenshot.width,
        screenshot.height,
        screenshot.timestamp.clone(),
    ).map_err(|e| format!("Failed to save to training data: {}", e))?;

    // Mark screenshot as added to training
    screenshot_manager::mark_as_added_to_training(&screenshot_id)?;

    println!("[AddToTraining] Complete! Screenshot added with caption ({} chars)", caption.len());

    Ok(())
}

// Transcript management commands
#[tauri::command]
async fn list_transcripts() -> Result<Vec<transcript_manager::TranscriptFile>, String> {
    let manager = transcript_manager::TranscriptManager::new()
        .map_err(|e| format!("Failed to initialize transcript manager: {}", e))?;

    manager.list_transcripts()
        .map_err(|e| format!("Failed to list transcripts: {}", e))
}

#[tauri::command]
async fn read_transcript(date: String, filename: String) -> Result<String, String> {
    let manager = transcript_manager::TranscriptManager::new()
        .map_err(|e| format!("Failed to initialize transcript manager: {}", e))?;

    manager.read_transcript(&date, &filename)
        .map_err(|e| format!("Failed to read transcript: {}", e))
}

#[tauri::command]
async fn batch_transcript(
    date: String,
    filename: String,
    sentences_per_batch: usize,
) -> Result<transcript_manager::BatchedTranscript, String> {
    let manager = transcript_manager::TranscriptManager::new()
        .map_err(|e| format!("Failed to initialize transcript manager: {}", e))?;

    manager.read_and_batch_transcript(&date, &filename, sentences_per_batch)
        .map_err(|e| format!("Failed to batch transcript: {}", e))
}

#[tauri::command]
async fn delete_transcript(date: String, filename: String) -> Result<(), String> {
    let manager = transcript_manager::TranscriptManager::new()
        .map_err(|e| format!("Failed to initialize transcript manager: {}", e))?;

    manager.delete_transcript(&date, &filename)
        .map_err(|e| format!("Failed to delete transcript: {}", e))
}

// Training data management commands
#[tauri::command]
async fn add_transcript_to_training(
    date: String,
    filename: String,
    content: String,
    message_count: usize,
    session_id: String,
) -> Result<training_data_manager::TrainingDataItem, String> {
    let manager = training_data_manager::TrainingDataManager::new()
        .map_err(|e| format!("Failed to initialize training data manager: {}", e))?;

    manager.add_transcript_to_training(date, filename, content, message_count, session_id)
        .map_err(|e| format!("Failed to add transcript to training: {}", e))
}

#[tauri::command]
async fn add_multiple_transcripts_to_training(
    transcripts: Vec<(String, String, String, usize, String)>,
) -> Result<Vec<training_data_manager::TrainingDataItem>, String> {
    let manager = training_data_manager::TrainingDataManager::new()
        .map_err(|e| format!("Failed to initialize training data manager: {}", e))?;

    manager.add_multiple_transcripts(transcripts)
        .map_err(|e| format!("Failed to add transcripts to training: {}", e))
}

#[tauri::command]
async fn list_training_data() -> Result<Vec<training_data_manager::TrainingDataItem>, String> {
    let manager = training_data_manager::TrainingDataManager::new()
        .map_err(|e| format!("Failed to initialize training data manager: {}", e))?;

    manager.list_training_data()
        .map_err(|e| format!("Failed to list training data: {}", e))
}

#[tauri::command]
async fn get_training_stats() -> Result<training_data_manager::TrainingCollection, String> {
    let manager = training_data_manager::TrainingDataManager::new()
        .map_err(|e| format!("Failed to initialize training data manager: {}", e))?;

    manager.get_training_stats()
        .map_err(|e| format!("Failed to get training stats: {}", e))
}

#[tauri::command]
async fn delete_training_item(item_id: String) -> Result<(), String> {
    let manager = training_data_manager::TrainingDataManager::new()
        .map_err(|e| format!("Failed to initialize training data manager: {}", e))?;

    manager.delete_training_item(&item_id)
        .map_err(|e| format!("Failed to delete training item: {}", e))
}

#[tauri::command]
async fn clear_all_training_data() -> Result<(), String> {
    let manager = training_data_manager::TrainingDataManager::new()
        .map_err(|e| format!("Failed to initialize training data manager: {}", e))?;

    manager.clear_all_training_data()
        .map_err(|e| format!("Failed to clear training data: {}", e))
}

// Document training commands
#[tauri::command]
async fn add_document_to_training(
    doc_id: String,
    doc_name: String,
    content: String,
    file_type: String,
    size: u64,
) -> Result<training_data_manager::TrainingDataItem, String> {
    let manager = training_data_manager::TrainingDataManager::new()
        .map_err(|e| format!("Failed to initialize training data manager: {}", e))?;

    manager.add_document_to_training(doc_id, doc_name, content, file_type, size)
        .map_err(|e| format!("Failed to add document to training: {}", e))
}

#[tauri::command]
async fn add_multiple_documents_to_training(
    documents: Vec<(String, String, String, String, u64)>,
) -> Result<Vec<training_data_manager::TrainingDataItem>, String> {
    let manager = training_data_manager::TrainingDataManager::new()
        .map_err(|e| format!("Failed to initialize training data manager: {}", e))?;

    manager.add_multiple_documents(documents)
        .map_err(|e| format!("Failed to add documents to training: {}", e))
}

// RAG System commands - Using SIMPLE RAG (no embeddings, instant creation)
#[tauri::command]
async fn create_rag_persona(
    app: tauri::AppHandle,
    name: String,
    description: String,
    training_item_ids: Vec<String>,
) -> Result<simple_rag_manager::SimpleRagPersona, String> {
    println!("\n=== [Command] create_rag_persona START ===");
    println!("[Command] Name: {}", name);
    println!("[Command] Description: {}", description);
    println!("[Command] Training item IDs: {:?}", training_item_ids);
    println!("[Command] Number of items: {}", training_item_ids.len());

    println!("[Command] Initializing SimpleRagManager...");
    let manager = simple_rag_manager::SimpleRagManager::new()
        .map_err(|e| {
            let err_msg = format!("Failed to initialize RAG manager: {}", e);
            eprintln!("[Command] ERROR: {}", err_msg);
            err_msg
        })?;

    println!("[Command] ✅ Manager initialized successfully");
    println!("[Command] Calling create_persona (async)...");

    let result = manager.create_persona(name.clone(), description, training_item_ids, app).await
        .map_err(|e| {
            let err_msg = format!("Failed to create RAG persona '{}': {}", name, e);
            eprintln!("[Command] ERROR: {}", err_msg);
            err_msg
        });

    match &result {
        Ok(persona) => {
            println!("[Command] ✅ SUCCESS: Persona created with ID: {}", persona.id);
            println!("=== [Command] create_rag_persona END ===\n");
        }
        Err(e) => {
            eprintln!("[Command] ❌ FAILED: {}", e);
            eprintln!("=== [Command] create_rag_persona END WITH ERROR ===\n");
        }
    }

    result
}

#[tauri::command]
async fn list_rag_personas() -> Result<Vec<simple_rag_manager::SimpleRagPersona>, String> {
    let manager = simple_rag_manager::SimpleRagManager::new()
        .map_err(|e| format!("Failed to initialize RAG manager: {}", e))?;

    manager.list_personas()
        .map_err(|e| format!("Failed to list RAG personas: {}", e))
}

#[tauri::command]
async fn query_rag_system(
    persona_id: String,
    query: String,
    top_k: usize,
) -> Result<Vec<simple_rag_manager::SimpleRagChunk>, String> {
    let manager = simple_rag_manager::SimpleRagManager::new()
        .map_err(|e| format!("Failed to initialize RAG manager: {}", e))?;

    manager.query(&persona_id, query, top_k)
        .map_err(|e| format!("Failed to query RAG system: {}", e))
}

#[tauri::command]
async fn delete_rag_persona(persona_id: String) -> Result<(), String> {
    let manager = simple_rag_manager::SimpleRagManager::new()
        .map_err(|e| format!("Failed to initialize RAG manager: {}", e))?;

    manager.delete_persona(&persona_id)
        .map_err(|e| format!("Failed to delete RAG persona: {}", e))
}

#[tauri::command]
async fn get_rag_persona(persona_id: String) -> Result<simple_rag_manager::SimpleRagPersona, String> {
    let manager = simple_rag_manager::SimpleRagManager::new()
        .map_err(|e| format!("Failed to initialize RAG manager: {}", e))?;

    manager.get_persona(&persona_id)
        .map_err(|e| format!("Failed to get RAG persona: {}", e))
}

// NEW: Get full context for a RAG persona (for long-context LLMs)
#[tauri::command]
async fn get_rag_full_context(persona_id: String) -> Result<String, String> {
    let manager = simple_rag_manager::SimpleRagManager::new()
        .map_err(|e| format!("Failed to initialize RAG manager: {}", e))?;

    manager.get_full_context(&persona_id)
        .map_err(|e| format!("Failed to get full context: {}", e))
}

// OpenAI RAG System commands - Production-ready semantic search
#[tauri::command]
async fn create_openai_rag_persona(
    app: tauri::AppHandle,
    name: String,
    description: String,
    training_item_ids: Vec<String>,
    api_key: String,
) -> Result<openai_rag_manager::OpenAIRagPersona, String> {
    tracing::info!("\n=== [Command] create_openai_rag_persona START ===");
    tracing::info!("[Command] Name: {}", name);
    tracing::info!("[Command] Training items: {}", training_item_ids.len());

    let manager = openai_rag_manager::OpenAIRagManager::new()
        .map_err(|e| format!("Failed to initialize OpenAI RAG manager: {}", e))?;

    let result = manager.create_persona(name.clone(), description, training_item_ids, api_key, app).await
        .map_err(|e| {
            let err_msg = format!("Failed to create OpenAI RAG persona '{}': {}", name, e);
            tracing::error!("{}", err_msg);
            err_msg
        });

    if let Ok(ref persona) = result {
        tracing::info!("✅ SUCCESS: OpenAI RAG persona created with ID: {}", persona.id);
    }

    tracing::info!("=== [Command] create_openai_rag_persona END ===\n");
    result
}

#[tauri::command]
async fn query_openai_rag(
    persona_id: String,
    query: String,
    api_key: String,
    top_k: usize,
) -> Result<Vec<openai_rag_manager::SearchResult>, String> {
    let manager = openai_rag_manager::OpenAIRagManager::new()
        .map_err(|e| format!("Failed to initialize OpenAI RAG manager: {}", e))?;

    manager.query(&persona_id, query, api_key, top_k).await
        .map_err(|e| format!("Failed to query OpenAI RAG: {}", e))
}

#[tauri::command]
async fn list_openai_rag_personas() -> Result<Vec<openai_rag_manager::OpenAIRagPersona>, String> {
    let manager = openai_rag_manager::OpenAIRagManager::new()
        .map_err(|e| format!("Failed to initialize OpenAI RAG manager: {}", e))?;

    manager.list_personas()
        .map_err(|e| format!("Failed to list OpenAI RAG personas: {}", e))
}

#[tauri::command]
async fn delete_openai_rag_persona(persona_id: String) -> Result<(), String> {
    let manager = openai_rag_manager::OpenAIRagManager::new()
        .map_err(|e| format!("Failed to initialize OpenAI RAG manager: {}", e))?;

    manager.delete_persona(&persona_id)
        .map_err(|e| format!("Failed to delete OpenAI RAG persona: {}", e))
}

// ========== TRANSCRIPTION COMMANDS ==========

/// Transcribe audio using on-device Whisper (pre-built binary)
#[tauri::command]
async fn transcribe_audio_local(
    audio_data: Vec<f32>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use tauri::State;

    // Get transcription manager
    let manager = app.state::<Arc<Mutex<whisper_local::WhisperLocal>>>();
    let manager_guard = manager.lock().unwrap();

    manager_guard
        .transcribe(audio_data, &app)
        .map_err(|e| format!("Transcription failed: {}", e))
}

/// Check if local Whisper is available
#[tauri::command]
fn is_local_transcription_available(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri::State;

    let manager = app.state::<Arc<Mutex<whisper_local::WhisperLocal>>>();
    let manager_guard = manager.lock().unwrap();

    Ok(manager_guard.is_available())
}

/// Get whisper binary and model paths
#[tauri::command]
fn get_whisper_paths(app: tauri::AppHandle) -> Result<(String, String), String> {
    use tauri::State;

    let manager = app.state::<Arc<Mutex<whisper_local::WhisperLocal>>>();
    let manager_guard = manager.lock().unwrap();

    Ok(manager_guard.get_paths())
}

// ========== EMPLOYEE MONITORING COMMANDS ==========

/// Get list of all employees
#[tauri::command]
fn get_employees() -> Result<serde_json::Value, String> {
    use std::fs;

    let employees_index_path = "employees/index.json";
    let content = fs::read_to_string(employees_index_path)
        .map_err(|e| format!("Failed to read employees index: {}", e))?;

    let employees: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse employees index: {}", e))?;

    Ok(employees)
}

/// Get usage data for a specific employee
#[tauri::command]
fn get_employee_usage(employee_id: String) -> Result<serde_json::Value, String> {
    use std::fs;

    let usage_path = format!("employees/{}_usage.json", employee_id);
    let content = fs::read_to_string(&usage_path)
        .map_err(|e| format!("Failed to read employee usage data: {}", e))?;

    let usage_data: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse employee usage data: {}", e))?;

    Ok(usage_data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            test_event_system,
            get_app_version,
            set_window_height,
            write_conversation_to_file,
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
            open_settings_window,
            close_settings_window,
            capture_screenshot,
            capture_screenshot_with_caption,
            get_all_screenshots,
            delete_screenshot,
            get_screenshot_by_id,
            add_screenshot_to_training,
            generate_caption_with_ollama,
            add_screenshot_to_training_with_caption,
            agent_manager::check_agent_permissions,
            agent_manager::start_agent,
            agent_manager::stop_agent,
            agent_manager::test_agent,
            agent_manager::get_agent_status,
            list_transcripts,
            read_transcript,
            batch_transcript,
            delete_transcript,
            add_transcript_to_training,
            add_multiple_transcripts_to_training,
            list_training_data,
            get_training_stats,
            delete_training_item,
            clear_all_training_data,
            add_document_to_training,
            add_multiple_documents_to_training,
            create_rag_persona,
            list_rag_personas,
            query_rag_system,
            delete_rag_persona,
            get_rag_persona,
            get_rag_full_context,
            create_openai_rag_persona,
            query_openai_rag,
            list_openai_rag_personas,
            delete_openai_rag_persona,
            uitars_agent::start_uitars_agent,
            uitars_agent::stop_uitars_agent,
            uitars_agent::execute_uitars_command,
            uitars_agent::is_uitars_running,
            secure_storage::store_api_key,
            secure_storage::get_api_key,
            secure_storage::delete_api_key,
            secure_storage::list_stored_providers,
            secure_storage::has_api_key,
            secure_storage::migrate_keys_to_secure_storage,
            transcribe_audio_local,
            is_local_transcription_available,
            get_whisper_paths,
            get_employees,
            get_employee_usage,
        ])
        .setup(|app| {
            // Initialize logging system FIRST
            if let Err(e) = logger::init_logging() {
                eprintln!("Failed to initialize logging: {}", e);
            } else {
                println!("✅ Logging system initialized successfully");
            }

            // Make a shared place to store the sidecar child
            app.manage(Mutex::new(None::<Child>));

            // Initialize agent state
            app.manage(agent_manager::AgentState::new());

            // Initialize UI-TARS agent
            let uitars_agent = Arc::new(Mutex::new(uitars_agent::UITarsAgent::new()));
            app.manage(uitars_agent);

            // Initialize local Whisper transcription
            let binary_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("binaries/whisper-mac-arm64");
            let model_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("models/ggml-base.en.bin");

            match whisper_local::WhisperLocal::new(binary_path.clone(), model_path.clone()) {
                Ok(whisper) => {
                    app.manage(Arc::new(Mutex::new(whisper)));
                    println!("✅ Local Whisper transcription initialized");
                    println!("   Binary: {}", binary_path.display());
                    println!("   Model: {}", model_path.display());
                }
                Err(e) => {
                    eprintln!("⚠️  Failed to initialize local Whisper: {}", e);
                    eprintln!("   Transcription will fall back to OpenAI API");
                    // Create a placeholder that will always fail
                    let whisper = whisper_local::WhisperLocal::new(
                        std::path::PathBuf::from("/nonexistent/binary"),
                        std::path::PathBuf::from("/nonexistent/model"),
                    ).unwrap_or_else(|_| panic!("Failed to create placeholder"));
                    app.manage(Arc::new(Mutex::new(whisper)));
                }
            }

            // Setup main window positioning
            window::setup_main_window(app).expect("Failed to setup main window");

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
            // Allow auth, settings, and other windows to close normally
            let label = w.label();
            if label != "auth" && label != "settings" {
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
