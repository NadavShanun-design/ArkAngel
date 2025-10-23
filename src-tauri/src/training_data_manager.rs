use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrainingDataItem {
    pub id: String,
    pub source_type: String, // "transcript", "conversation", "document", etc.
    pub title: String,
    pub content: String,
    pub metadata: TrainingMetadata,
    pub added_at: String, // ISO 8601 timestamp
    pub format: String,    // "json", "text", "markdown"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrainingMetadata {
    pub source_id: String,
    pub source_date: Option<String>,
    pub source_time: Option<String>,
    pub message_count: Option<usize>,
    pub session_id: Option<String>,
    pub original_filename: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrainingCollection {
    pub items: Vec<TrainingDataItem>,
    pub total_count: usize,
    pub total_size_bytes: usize,
    pub last_updated: String,
}

pub struct TrainingDataManager {
    training_dir: PathBuf,
    index_path: PathBuf,
}

impl TrainingDataManager {
    pub fn new() -> Result<Self> {
        // Find project root (similar to file_storage.rs)
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

        if let Ok(exe) = std::env::current_exe() {
            let mut p = exe.parent();
            for _ in 0..5 {
                if let Some(pp) = p {
                    candidates.push(pp.to_path_buf());
                    p = pp.parent();
                } else {
                    break;
                }
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

        let training_dir = project_root.join("training_data");
        let index_path = training_dir.join("training_index.json");

        // Create training_data directory if it doesn't exist
        fs::create_dir_all(&training_dir)?;

        Ok(Self {
            training_dir,
            index_path,
        })
    }

    /// Add transcript to training data
    pub fn add_transcript_to_training(
        &self,
        transcript_date: String,
        transcript_filename: String,
        transcript_content: String,
        message_count: usize,
        session_id: String,
    ) -> Result<TrainingDataItem> {
        let id = format!("training_transcript_{}_{}", transcript_date, session_id);

        // Format content for RAG system (structured JSON)
        let structured_content = self.format_transcript_for_training(&transcript_content);

        let item = TrainingDataItem {
            id: id.clone(),
            source_type: "transcript".to_string(),
            title: format!("Transcript: {} at {}", transcript_date, session_id),
            content: structured_content,
            metadata: TrainingMetadata {
                source_id: format!("{}_{}", transcript_date, transcript_filename),
                source_date: Some(transcript_date.clone()),
                source_time: None,
                message_count: Some(message_count),
                session_id: Some(session_id.clone()),
                original_filename: Some(transcript_filename),
            },
            added_at: Utc::now().to_rfc3339(),
            format: "json".to_string(),
        };

        // Save individual training file
        self.save_training_item(&item)?;

        // Update index
        self.add_to_index(&item)?;

        Ok(item)
    }

    /// Format transcript content for RAG training
    fn format_transcript_for_training(&self, content: &str) -> String {
        // Parse transcript and convert to structured JSON format
        // This format is optimized for RAG systems

        let mut messages: Vec<serde_json::Value> = Vec::new();
        let lines: Vec<&str> = content.lines().collect();

        let mut current_role = "";
        let mut current_content = String::new();
        let mut current_timestamp = "";

        for line in lines {
            let trimmed = line.trim();

            // Skip separators and headers
            if trimmed.starts_with("===") || trimmed.is_empty() {
                continue;
            }

            // Detect message start: [HH:MM:SS] ROLE:
            if trimmed.starts_with('[') && (trimmed.contains("USER:") || trimmed.contains("AI:")) {
                // Save previous message if exists
                if !current_content.is_empty() {
                    messages.push(serde_json::json!({
                        "role": current_role.to_lowercase(),
                        "content": current_content.trim(),
                        "timestamp": current_timestamp
                    }));
                    current_content.clear();
                }

                // Parse new message
                if let Some(timestamp_end) = trimmed.find(']') {
                    current_timestamp = &trimmed[1..timestamp_end];
                    let rest = &trimmed[timestamp_end + 1..].trim();

                    if rest.starts_with("USER:") {
                        current_role = "user";
                        current_content = rest[5..].trim().to_string();
                    } else if rest.starts_with("AI:") {
                        current_role = "assistant";
                        current_content = rest[3..].trim().to_string();
                    }
                }
            } else {
                // Continuation of current message
                if !current_content.is_empty() {
                    current_content.push(' ');
                }
                current_content.push_str(trimmed);
            }
        }

        // Save last message
        if !current_content.is_empty() {
            messages.push(serde_json::json!({
                "role": current_role.to_lowercase(),
                "content": current_content.trim(),
                "timestamp": current_timestamp
            }));
        }

        // Create RAG-optimized structure
        let training_format = serde_json::json!({
            "type": "conversation",
            "messages": messages,
            "format_version": "1.0",
            "optimized_for": "rag_training"
        });

        serde_json::to_string_pretty(&training_format).unwrap_or_else(|_| content.to_string())
    }

    /// Save individual training item to file
    fn save_training_item(&self, item: &TrainingDataItem) -> Result<()> {
        let filename = format!("{}.json", item.id);
        let file_path = self.training_dir.join(filename);

        let json_content = serde_json::to_string_pretty(item)?;
        fs::write(&file_path, json_content)?;

        println!("[TrainingDataManager] Saved training item: {}", item.id);
        Ok(())
    }

    /// Add item to index
    fn add_to_index(&self, item: &TrainingDataItem) -> Result<()> {
        let mut collection = self.load_collection()?;

        // Check if already exists
        if !collection.items.iter().any(|i| i.id == item.id) {
            collection.items.push(item.clone());
            collection.total_count = collection.items.len();
            collection.total_size_bytes += item.content.len();
            collection.last_updated = Utc::now().to_rfc3339();

            self.save_collection(&collection)?;
        }

        Ok(())
    }

    /// Load training collection
    fn load_collection(&self) -> Result<TrainingCollection> {
        if !self.index_path.exists() {
            return Ok(TrainingCollection {
                items: Vec::new(),
                total_count: 0,
                total_size_bytes: 0,
                last_updated: Utc::now().to_rfc3339(),
            });
        }

        let content = fs::read_to_string(&self.index_path)?;
        let collection: TrainingCollection = serde_json::from_str(&content)?;
        Ok(collection)
    }

    /// Save training collection
    fn save_collection(&self, collection: &TrainingCollection) -> Result<()> {
        let json_content = serde_json::to_string_pretty(collection)?;
        fs::write(&self.index_path, json_content)?;
        Ok(())
    }

    /// List all training data items
    pub fn list_training_data(&self) -> Result<Vec<TrainingDataItem>> {
        let collection = self.load_collection()?;
        Ok(collection.items)
    }

    /// Get training collection statistics
    pub fn get_training_stats(&self) -> Result<TrainingCollection> {
        self.load_collection()
    }

    /// Delete training item
    pub fn delete_training_item(&self, item_id: &str) -> Result<()> {
        // Remove from index
        let mut collection = self.load_collection()?;

        if let Some(pos) = collection.items.iter().position(|i| i.id == item_id) {
            let item = collection.items.remove(pos);
            collection.total_count = collection.items.len();
            collection.total_size_bytes = collection.total_size_bytes.saturating_sub(item.content.len());
            collection.last_updated = Utc::now().to_rfc3339();

            self.save_collection(&collection)?;

            // Delete file
            let filename = format!("{}.json", item_id);
            let file_path = self.training_dir.join(filename);
            if file_path.exists() {
                fs::remove_file(&file_path)?;
            }

            println!("[TrainingDataManager] Deleted training item: {}", item_id);
        }

        Ok(())
    }

    /// Get single training item
    pub fn get_training_item(&self, item_id: &str) -> Result<TrainingDataItem> {
        let collection = self.load_collection()?;

        collection
            .items
            .iter()
            .find(|i| i.id == item_id)
            .cloned()
            .ok_or_else(|| anyhow!("Training item not found: {}", item_id))
    }

    /// Add multiple transcripts to training (batch operation)
    pub fn add_multiple_transcripts(
        &self,
        transcripts: Vec<(String, String, String, usize, String)>, // (date, filename, content, msg_count, session_id)
    ) -> Result<Vec<TrainingDataItem>> {
        let mut added_items = Vec::new();

        for (date, filename, content, msg_count, session_id) in transcripts {
            match self.add_transcript_to_training(date, filename, content, msg_count, session_id) {
                Ok(item) => added_items.push(item),
                Err(e) => eprintln!("[TrainingDataManager] Failed to add transcript: {}", e),
            }
        }

        Ok(added_items)
    }

    /// Add document to training data
    pub fn add_document_to_training(
        &self,
        doc_id: String,
        doc_name: String,
        content: String,
        file_type: String,
        size: u64,
    ) -> Result<TrainingDataItem> {
        let id = format!("training_document_{}", doc_id);

        // Format content for RAG system (structured JSON)
        let structured_content = self.format_document_for_training(&content, &file_type);

        let item = TrainingDataItem {
            id: id.clone(),
            source_type: "document".to_string(),
            title: format!("Document: {}", doc_name),
            content: structured_content,
            metadata: TrainingMetadata {
                source_id: doc_id.clone(),
                source_date: None,
                source_time: None,
                message_count: None,
                session_id: None,
                original_filename: Some(doc_name.clone()),
            },
            added_at: Utc::now().to_rfc3339(),
            format: "json".to_string(),
        };

        // Save individual training file
        self.save_training_item(&item)?;

        // Update index
        self.add_to_index(&item)?;

        println!(
            "[TrainingDataManager] Added document to training: {} ({} bytes)",
            doc_name, size
        );

        Ok(item)
    }

    /// Format document content for RAG training
    fn format_document_for_training(&self, content: &str, file_type: &str) -> String {
        // Create RAG-optimized structure for document content
        // This format chunks the document and adds metadata

        // Simple chunking strategy: split by paragraphs or every ~500 words
        let chunks = self.create_content_chunks(content, 500);

        let training_format = serde_json::json!({
            "type": "document",
            "file_type": file_type,
            "chunks": chunks,
            "format_version": "1.0",
            "optimized_for": "rag_training"
        });

        serde_json::to_string_pretty(&training_format).unwrap_or_else(|_| content.to_string())
    }

    /// Create content chunks for RAG training
    fn create_content_chunks(&self, content: &str, chunk_size: usize) -> Vec<serde_json::Value> {
        let words: Vec<&str> = content.split_whitespace().collect();
        let mut chunks = Vec::new();

        if words.is_empty() {
            return chunks;
        }

        let mut start = 0;
        let mut chunk_index = 0;

        while start < words.len() {
            let end = std::cmp::min(start + chunk_size, words.len());
            let chunk_words = &words[start..end];
            let chunk_text = chunk_words.join(" ");

            chunks.push(serde_json::json!({
                "index": chunk_index,
                "text": chunk_text,
                "word_count": chunk_words.len(),
                "start_word": start,
                "end_word": end
            }));

            start = end;
            chunk_index += 1;
        }

        chunks
    }

    /// Add multiple documents to training (batch operation)
    pub fn add_multiple_documents(
        &self,
        documents: Vec<(String, String, String, String, u64)>, // (doc_id, doc_name, content, file_type, size)
    ) -> Result<Vec<TrainingDataItem>> {
        let mut added_items = Vec::new();

        for (doc_id, doc_name, content, file_type, size) in documents {
            match self.add_document_to_training(doc_id, doc_name, content, file_type, size) {
                Ok(item) => added_items.push(item),
                Err(e) => eprintln!("[TrainingDataManager] Failed to add document: {}", e),
            }
        }

        Ok(added_items)
    }

    /// Clear all training data
    pub fn clear_all_training_data(&self) -> Result<()> {
        // Clear index
        let empty_collection = TrainingCollection {
            items: Vec::new(),
            total_count: 0,
            total_size_bytes: 0,
            last_updated: Utc::now().to_rfc3339(),
        };
        self.save_collection(&empty_collection)?;

        // Delete all training files
        if self.training_dir.exists() {
            for entry in fs::read_dir(&self.training_dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("json") {
                    // Keep the index file
                    if path.file_name().and_then(|n| n.to_str()) != Some("training_index.json") {
                        fs::remove_file(&path)?;
                    }
                }
            }
        }

        println!("[TrainingDataManager] Cleared all training data");
        Ok(())
    }
}
