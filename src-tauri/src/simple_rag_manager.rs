use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::Utc;
use tauri::Emitter;

use crate::training_data_manager::{TrainingDataManager, TrainingDataItem};

/// Progress event emitted during RAG persona creation
#[derive(Debug, Serialize, Clone)]
struct RagProgressEvent {
    status: String,
    step: u32,
    total_steps: u32,
    percentage: u32,
    details: Option<String>,
}

/// Log event emitted to frontend for real-time monitoring
#[derive(Debug, Serialize, Clone)]
struct LogEvent {
    level: String,
    source: String,
    message: String,
    details: Option<String>,
}

impl LogEvent {
    fn info(source: &str, message: String) -> Self {
        Self {
            level: "info".to_string(),
            source: source.to_string(),
            message,
            details: None,
        }
    }

    fn success(source: &str, message: String) -> Self {
        Self {
            level: "success".to_string(),
            source: source.to_string(),
            message,
            details: None,
        }
    }

    fn error(source: &str, message: String, details: Option<String>) -> Self {
        Self {
            level: "error".to_string(),
            source: source.to_string(),
            message,
            details,
        }
    }

    fn debug(source: &str, message: String, details: Option<String>) -> Self {
        Self {
            level: "debug".to_string(),
            source: source.to_string(),
            message,
            details,
        }
    }
}

/// Simplified RAG Persona - No embeddings, just links to training data
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SimpleRagPersona {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
    pub training_item_ids: Vec<String>,
    pub source_count: usize,
}

/// RAG Query Result - Simple text chunks with metadata
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SimpleRagChunk {
    pub id: String,
    pub text: String,
    pub source_id: String,
    pub source_type: String,
    pub source_name: String,
    pub chunk_index: usize,
}

pub struct SimpleRagManager {
    rag_dir: PathBuf,
    training_manager: TrainingDataManager,
}

impl SimpleRagManager {
    pub fn new() -> Result<Self> {
        // Find project root
        let mut candidates: Vec<PathBuf> = Vec::new();

        if let Ok(dir) = std::env::var("ARKANGEL_PROJECT_ROOT") {
            candidates.push(PathBuf::from(dir));
        }

        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        if let Some(p) = manifest_dir.parent() {
            candidates.push(p.to_path_buf());
        }

        if let Ok(cd) = std::env::current_dir() {
            candidates.push(cd.clone());
            if let Some(p) = cd.parent() {
                candidates.push(p.to_path_buf());
            }
        }

        let project_root = candidates
            .into_iter()
            .find(|base| {
                base.join("training_data").exists()
                    || base.join("sidecar").exists()
                    || base.join("src-tauri").exists()
            })
            .unwrap_or_else(|| PathBuf::from("."));

        let rag_dir = project_root.join("rag_personas");
        fs::create_dir_all(&rag_dir)?;

        let training_manager = TrainingDataManager::new()?;

        Ok(Self {
            rag_dir,
            training_manager,
        })
    }

    /// Create RAG persona instantly - just links to training data, no embeddings
    pub async fn create_persona(
        &self,
        name: String,
        description: String,
        training_item_ids: Vec<String>,
        app_handle: tauri::AppHandle,
    ) -> Result<SimpleRagPersona> {
        println!("\n=== [SimpleRAG] Starting RAG Persona Creation ===");
        println!("[SimpleRAG] Name: {}", name);
        println!("[SimpleRAG] Description: {}", description);
        println!("[SimpleRAG] Training items: {:?}", training_item_ids);

        // Emit startup log
        println!("[SimpleRAG] Emitting startup logs to frontend...");
        if let Err(e) = app_handle.emit("app_log", LogEvent::info(
            "RAG",
            format!("🚀 Starting RAG persona creation: '{}'", name)
        )) {
            eprintln!("[SimpleRAG] ERROR: Failed to emit startup log: {}", e);
        } else {
            println!("[SimpleRAG] ✅ Startup log emitted");
        }

        if let Err(e) = app_handle.emit("app_log", LogEvent::debug(
            "RAG",
            format!("Configuration: {} training items selected", training_item_ids.len()),
            Some(format!("Items: {:?}", training_item_ids))
        )) {
            eprintln!("[SimpleRAG] ERROR: Failed to emit debug log: {}", e);
        } else {
            println!("[SimpleRAG] ✅ Debug log emitted");
        }

        // Step 1: Validate training data (20%)
        println!("[SimpleRAG] Step 1/5: Validating {} training items", training_item_ids.len());
        if let Err(e) = app_handle.emit("app_log", LogEvent::info(
            "RAG",
            format!("📋 Step 1/5: Validating {} training items", training_item_ids.len())
        )) {
            eprintln!("[SimpleRAG] ERROR emitting log: {}", e);
        }

        let event1 = RagProgressEvent {
            status: "Validating training data...".to_string(),
            step: 1,
            total_steps: 5,
            percentage: 20,
            details: Some(format!("{} items selected", training_item_ids.len())),
        };
        println!("[SimpleRAG] Emitting rag_progress event: {:?}", event1);
        if let Err(e) = app_handle.emit("rag_progress", event1) {
            eprintln!("[SimpleRAG] ❌ ERROR emitting progress event 1: {}", e);
            let _ = app_handle.emit("app_log", LogEvent::error(
                "RAG",
                "Failed to emit progress event".to_string(),
                Some(e.to_string())
            ));
        } else {
            println!("[SimpleRAG] ✅ Progress event 1 emitted successfully");
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

        // Verify all training items exist
        for (idx, item_id) in training_item_ids.iter().enumerate() {
            println!("[SimpleRAG] Validating item {}/{}: {}", idx + 1, training_item_ids.len(), item_id);
            let _ = app_handle.emit("app_log", LogEvent::debug(
                "RAG",
                format!("Validating item {}/{}: {}", idx + 1, training_item_ids.len(), item_id),
                None
            ));

            if self.training_manager.get_training_item(item_id).is_err() {
                let error_msg = format!("Training item not found: {}", item_id);
                eprintln!("[SimpleRAG] ERROR: {}", error_msg);
                let _ = app_handle.emit("app_log", LogEvent::error(
                    "RAG",
                    error_msg.clone(),
                    Some(format!("Item ID: {}", item_id))
                ));
                return Err(anyhow!(error_msg));
            }
        }

        let _ = app_handle.emit("app_log", LogEvent::success(
            "RAG",
            format!("✅ All {} training items validated successfully", training_item_ids.len())
        ));

        // Step 2: Load training items (40%)
        println!("[SimpleRAG] Step 2/5: Loading training items");
        let _ = app_handle.emit("app_log", LogEvent::info(
            "RAG",
            "📚 Step 2/5: Loading training items from disk".to_string()
        ));

        let event2 = RagProgressEvent {
            status: "Loading training items...".to_string(),
            step: 2,
            total_steps: 5,
            percentage: 40,
            details: Some("Reading metadata and content".to_string()),
        };
        println!("[SimpleRAG] Emitting event: {:?}", event2);
        if let Err(e) = app_handle.emit("rag_progress", event2) {
            eprintln!("[SimpleRAG] ERROR emitting event 2: {}", e);
        } else {
            println!("[SimpleRAG] ✅ Event 2 emitted successfully");
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

        let mut loaded_items = Vec::new();
        for (idx, item_id) in training_item_ids.iter().enumerate() {
            let _ = app_handle.emit("app_log", LogEvent::debug(
                "RAG",
                format!("Loading item {}/{}: {}", idx + 1, training_item_ids.len(), item_id),
                None
            ));
            let item = self.training_manager.get_training_item(item_id)?;
            loaded_items.push(item);
        }

        let _ = app_handle.emit("app_log", LogEvent::success(
            "RAG",
            format!("✅ Loaded {} training items successfully", loaded_items.len())
        ));

        // Step 3: Extract text content (60%)
        println!("[SimpleRAG] Step 3/5: Extracting text from {} items", loaded_items.len());
        let _ = app_handle.emit("app_log", LogEvent::info(
            "RAG",
            format!("🔍 Step 3/5: Extracting text from {} items", loaded_items.len())
        ));

        let event3 = RagProgressEvent {
            status: "Extracting text content...".to_string(),
            step: 3,
            total_steps: 5,
            percentage: 60,
            details: Some(format!("Processing {} items", loaded_items.len())),
        };
        println!("[SimpleRAG] Emitting event: {:?}", event3);
        if let Err(e) = app_handle.emit("rag_progress", event3) {
            eprintln!("[SimpleRAG] ERROR emitting event 3: {}", e);
        } else {
            println!("[SimpleRAG] ✅ Event 3 emitted successfully");
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

        let mut total_chunks = 0;
        for (idx, item) in loaded_items.iter().enumerate() {
            let _ = app_handle.emit("app_log", LogEvent::debug(
                "RAG",
                format!("Extracting chunks from item {}/{}: {}", idx + 1, loaded_items.len(), item.title),
                None
            ));
            let chunks = self.extract_chunks_from_item(item)?;
            total_chunks += chunks.len();
            let _ = app_handle.emit("app_log", LogEvent::debug(
                "RAG",
                format!("  → Extracted {} chunks from '{}'", chunks.len(), item.title),
                None
            ));
        }
        println!("[SimpleRAG] Extracted {} text chunks", total_chunks);
        let _ = app_handle.emit("app_log", LogEvent::success(
            "RAG",
            format!("✅ Extracted {} text chunks total", total_chunks)
        ));

        // Step 4: Create persona object (80%)
        println!("[SimpleRAG] Step 4/5: Creating persona object");
        let _ = app_handle.emit("app_log", LogEvent::info(
            "RAG",
            format!("📝 Step 4/5: Creating persona metadata for '{}'", name)
        ));

        let event4 = RagProgressEvent {
            status: "Creating persona file...".to_string(),
            step: 4,
            total_steps: 5,
            percentage: 80,
            details: Some(format!("Persona: {}", name)),
        };
        println!("[SimpleRAG] Emitting event: {:?}", event4);
        if let Err(e) = app_handle.emit("rag_progress", event4) {
            eprintln!("[SimpleRAG] ERROR emitting event 4: {}", e);
        } else {
            println!("[SimpleRAG] ✅ Event 4 emitted successfully");
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

        let id = format!("rag_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
        let _ = app_handle.emit("app_log", LogEvent::debug(
            "RAG",
            format!("Generated persona ID: {}", id),
            None
        ));

        let persona = SimpleRagPersona {
            id: id.clone(),
            name: name.clone(),
            description,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
            training_item_ids: training_item_ids.clone(),
            source_count: training_item_ids.len(),
        };

        let _ = app_handle.emit("app_log", LogEvent::success(
            "RAG",
            "✅ Persona metadata created".to_string()
        ));

        // Step 5: Save to disk (100%)
        println!("[SimpleRAG] Step 5/5: Saving persona to disk");
        let _ = app_handle.emit("app_log", LogEvent::info(
            "RAG",
            "💾 Step 5/5: Saving persona to disk".to_string()
        ));

        let event5 = RagProgressEvent {
            status: "Saving persona...".to_string(),
            step: 5,
            total_steps: 5,
            percentage: 90,
            details: Some("Writing to disk".to_string()),
        };
        println!("[SimpleRAG] Emitting event: {:?}", event5);
        if let Err(e) = app_handle.emit("rag_progress", event5) {
            eprintln!("[SimpleRAG] ERROR emitting event 5: {}", e);
        } else {
            println!("[SimpleRAG] ✅ Event 5 emitted successfully");
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

        let persona_file = self.rag_dir.join(format!("{}.json", id));
        println!("[SimpleRAG] Writing persona to: {:?}", persona_file);
        let _ = app_handle.emit("app_log", LogEvent::debug(
            "RAG",
            format!("Saving to: {:?}", persona_file),
            None
        ));

        let json_content = serde_json::to_string_pretty(&persona)?;
        fs::write(&persona_file, json_content)?;
        println!("[SimpleRAG] Persona file written successfully");

        let _ = app_handle.emit("app_log", LogEvent::success(
            "RAG",
            "✅ Persona file written to disk".to_string()
        ));

        // Final complete event
        let event_complete = RagProgressEvent {
            status: "Persona created successfully!".to_string(),
            step: 5,
            total_steps: 5,
            percentage: 100,
            details: Some(format!("Ready to use: {}", name)),
        };
        println!("[SimpleRAG] Emitting completion event: {:?}", event_complete);
        if let Err(e) = app_handle.emit("rag_progress", event_complete) {
            eprintln!("[SimpleRAG] ERROR emitting completion event: {}", e);
        } else {
            println!("[SimpleRAG] ✅ Completion event emitted successfully");
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

        println!("[SimpleRAG] ✅ Created persona: {} with {} sources ({} chunks)",
                 persona.name, persona.source_count, total_chunks);

        let _ = app_handle.emit("app_log", LogEvent::success(
            "RAG",
            format!("🎉 Persona '{}' created successfully! ({} sources, {} chunks)",
                    persona.name, persona.source_count, total_chunks)
        ));

        println!("=== [SimpleRAG] RAG Persona Creation Complete ===\n");
        Ok(persona)
    }

    /// List all RAG personas
    pub fn list_personas(&self) -> Result<Vec<SimpleRagPersona>> {
        let mut personas = Vec::new();

        if !self.rag_dir.exists() {
            return Ok(personas);
        }

        for entry in fs::read_dir(&self.rag_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(persona) = serde_json::from_str::<SimpleRagPersona>(&content) {
                        personas.push(persona);
                    }
                }
            }
        }

        // Sort by created_at (newest first)
        personas.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(personas)
    }

    /// Get a specific persona
    pub fn get_persona(&self, persona_id: &str) -> Result<SimpleRagPersona> {
        let persona_file = self.rag_dir.join(format!("{}.json", persona_id));

        if !persona_file.exists() {
            return Err(anyhow!("Persona not found: {}", persona_id));
        }

        let content = fs::read_to_string(&persona_file)?;
        let persona: SimpleRagPersona = serde_json::from_str(&content)?;
        Ok(persona)
    }

    /// Query RAG system - returns ALL training data as chunks (LLM will find relevant parts)
    pub fn query(
        &self,
        persona_id: &str,
        _query: String,  // Not used in simple version - LLM handles relevance
        top_k: usize,
    ) -> Result<Vec<SimpleRagChunk>> {
        let persona = self.get_persona(persona_id)?;
        let mut chunks = Vec::new();

        // Load all training items for this persona
        for item_id in &persona.training_item_ids {
            if let Ok(item) = self.training_manager.get_training_item(item_id) {
                // Extract text chunks from the training item
                let item_chunks = self.extract_chunks_from_item(&item)?;
                chunks.extend(item_chunks);
            }
        }

        // Return top_k chunks (or all if fewer than top_k)
        let return_count = std::cmp::min(top_k, chunks.len());
        Ok(chunks.into_iter().take(return_count).collect())
    }

    /// Extract text chunks from a training data item
    fn extract_chunks_from_item(&self, item: &TrainingDataItem) -> Result<Vec<SimpleRagChunk>> {
        let mut chunks = Vec::new();

        // Parse JSON content
        let content_json: serde_json::Value = serde_json::from_str(&item.content)?;

        if item.source_type == "transcript" {
            // Handle transcript format
            if let Some(messages) = content_json.get("messages").and_then(|m| m.as_array()) {
                let mut chunk_text = String::new();
                for (idx, msg) in messages.iter().enumerate() {
                    if let (Some(role), Some(content)) = (
                        msg.get("role").and_then(|r| r.as_str()),
                        msg.get("content").and_then(|c| c.as_str()),
                    ) {
                        chunk_text.push_str(&format!("{}: {}\n", role.to_uppercase(), content));

                        // Create chunks every 5 messages
                        if (idx + 1) % 5 == 0 || idx == messages.len() - 1 {
                            chunks.push(SimpleRagChunk {
                                id: format!("{}_{}", item.id, chunks.len()),
                                text: chunk_text.clone(),
                                source_id: item.id.clone(),
                                source_type: "transcript".to_string(),
                                source_name: item.title.clone(),
                                chunk_index: chunks.len(),
                            });
                            chunk_text.clear();
                        }
                    }
                }
            }
        } else if item.source_type == "document" {
            // Handle document format
            if let Some(doc_chunks) = content_json.get("chunks").and_then(|c| c.as_array()) {
                for chunk in doc_chunks {
                    if let Some(text) = chunk.get("text").and_then(|t| t.as_str()) {
                        chunks.push(SimpleRagChunk {
                            id: format!("{}_{}", item.id, chunks.len()),
                            text: text.to_string(),
                            source_id: item.id.clone(),
                            source_type: "document".to_string(),
                            source_name: item.title.clone(),
                            chunk_index: chunks.len(),
                        });
                    }
                }
            }
        }

        Ok(chunks)
    }

    /// Delete a RAG persona
    pub fn delete_persona(&self, persona_id: &str) -> Result<()> {
        let persona_file = self.rag_dir.join(format!("{}.json", persona_id));

        if persona_file.exists() {
            fs::remove_file(&persona_file)?;
            println!("[SimpleRAG] Deleted persona: {}", persona_id);
        }

        Ok(())
    }

    /// Get all training content for a persona as a single text block
    /// This is used to inject into system prompt for long-context LLMs
    pub fn get_full_context(&self, persona_id: &str) -> Result<String> {
        let chunks = self.query(persona_id, String::new(), 1000)?;  // Get many chunks

        let mut context = String::from("### Knowledge Base ###\n\n");

        for (idx, chunk) in chunks.iter().enumerate() {
            context.push_str(&format!(
                "=== Source {}: {} ===\n{}\n\n",
                idx + 1,
                chunk.source_name,
                chunk.text
            ));
        }

        Ok(context)
    }
}
