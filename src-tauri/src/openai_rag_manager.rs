use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::Utc;
use tauri::Emitter;
use async_openai::{Client, config::OpenAIConfig, types::{CreateEmbeddingRequestArgs}};
use ndarray::{Array1, Array2};

use crate::training_data_manager::{TrainingDataManager, TrainingDataItem};
use crate::logger::AppLogEvent;

/// RAG Persona with OpenAI embeddings
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpenAIRagPersona {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
    pub training_item_ids: Vec<String>,
    pub source_count: usize,
    pub chunk_count: usize,
    pub embedding_model: String,
}

/// Text chunk with embedding
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmbeddedChunk {
    pub id: String,
    pub text: String,
    pub source_id: String,
    pub source_type: String,
    pub source_name: String,
    pub chunk_index: usize,
    pub embedding: Vec<f32>,
}

/// Search result with relevance score
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub chunk_id: String,
    pub text: String,
    pub source_name: String,
    pub score: f32,
    pub chunk_index: usize,
}

/// Progress event for RAG creation
#[derive(Debug, Serialize, Clone)]
struct RagProgressEvent {
    status: String,
    step: u32,
    total_steps: u32,
    percentage: u32,
    details: Option<String>,
}

pub struct OpenAIRagManager {
    rag_dir: PathBuf,
    training_manager: TrainingDataManager,
}

impl OpenAIRagManager {
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

        let rag_dir = project_root.join("rag_personas_openai");
        fs::create_dir_all(&rag_dir)?;

        let training_manager = TrainingDataManager::new()?;

        Ok(Self {
            rag_dir,
            training_manager,
        })
    }

    /// Create RAG persona with OpenAI embeddings
    pub async fn create_persona(
        &self,
        name: String,
        description: String,
        training_item_ids: Vec<String>,
        api_key: String,
        app_handle: tauri::AppHandle,
    ) -> Result<OpenAIRagPersona> {
        tracing::info!("🚀 Starting OpenAI RAG persona creation: '{}'", name);
        AppLogEvent::info("OpenAIRAG", format!("🚀 Creating persona: '{}'", name)).emit_to_frontend(&app_handle);

        // Step 1: Validate inputs (10%)
        self.emit_progress(&app_handle, 1, 7, 10, "Validating inputs...", None).await;

        if training_item_ids.is_empty() {
            return Err(anyhow!("No training items provided"));
        }

        if api_key.is_empty() {
            return Err(anyhow!("OpenAI API key is required"));
        }

        // Step 2: Load training items (20%)
        self.emit_progress(&app_handle, 2, 7, 20, "Loading training data...", Some(format!("{} items", training_item_ids.len()))).await;
        AppLogEvent::info("OpenAIRAG", format!("Loading {} training items", training_item_ids.len())).emit_to_frontend(&app_handle);

        let mut all_items = Vec::new();
        for item_id in &training_item_ids {
            match self.training_manager.get_training_item(item_id) {
                Ok(item) => all_items.push(item),
                Err(e) => {
                    let error_msg = format!("Failed to load item {}: {}", item_id, e);
                    tracing::error!("{}", error_msg);
                    AppLogEvent::error("OpenAIRAG", error_msg.clone(), None).emit_to_frontend(&app_handle);
                    return Err(anyhow!(error_msg));
                }
            }
        }

        // Step 3: Create chunks (30%)
        self.emit_progress(&app_handle, 3, 7, 30, "Creating text chunks...", None).await;
        AppLogEvent::info("OpenAIRAG", "Chunking documents for optimal embedding size".to_string()).emit_to_frontend(&app_handle);

        let mut all_chunks = Vec::new();
        for item in &all_items {
            let chunks = self.chunk_training_item(item)?;
            all_chunks.extend(chunks);
        }

        tracing::info!("Created {} chunks from {} documents", all_chunks.len(), all_items.len());
        AppLogEvent::success("OpenAIRAG", format!("✅ Created {} text chunks", all_chunks.len())).emit_to_frontend(&app_handle);

        // Step 4: Generate embeddings via OpenAI (50%)
        self.emit_progress(&app_handle, 4, 7, 50, "Generating embeddings via OpenAI...", Some(format!("{} chunks", all_chunks.len()))).await;
        AppLogEvent::info("OpenAIRAG", "Calling OpenAI Embeddings API (this may take a moment)".to_string()).emit_to_frontend(&app_handle);

        let embedded_chunks = self.generate_embeddings(all_chunks, api_key, &app_handle).await?;

        AppLogEvent::success("OpenAIRAG", format!("✅ Generated {} embeddings successfully", embedded_chunks.len())).emit_to_frontend(&app_handle);

        // Step 5: Create persona metadata (70%)
        self.emit_progress(&app_handle, 5, 7, 70, "Creating persona metadata...", None).await;

        let id = format!("rag_{}", uuid::Uuid::new_v4().simple());
        let persona = OpenAIRagPersona {
            id: id.clone(),
            name: name.clone(),
            description,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
            training_item_ids: training_item_ids.clone(),
            source_count: training_item_ids.len(),
            chunk_count: embedded_chunks.len(),
            embedding_model: "text-embedding-3-small".to_string(),
        };

        // Step 6: Save to disk (85%)
        self.emit_progress(&app_handle, 6, 7, 85, "Saving persona to disk...", None).await;
        AppLogEvent::info("OpenAIRAG", "Writing persona and embeddings to disk".to_string()).emit_to_frontend(&app_handle);

        let persona_dir = self.rag_dir.join(&id);
        fs::create_dir_all(&persona_dir)?;

        // Save persona metadata
        let persona_file = persona_dir.join("persona.json");
        fs::write(&persona_file, serde_json::to_string_pretty(&persona)?)?;

        // Save embedded chunks
        let chunks_file = persona_dir.join("chunks.json");
        fs::write(&chunks_file, serde_json::to_string_pretty(&embedded_chunks)?)?;

        AppLogEvent::success("OpenAIRAG", format!("✅ Saved to {:?}", persona_dir)).emit_to_frontend(&app_handle);

        // Step 7: Complete (100%)
        self.emit_progress(&app_handle, 7, 7, 100, "Persona created successfully!", Some(format!("{} chunks ready", embedded_chunks.len()))).await;

        tracing::info!("✅ Created OpenAI RAG persona: {} ({} sources, {} chunks)", persona.name, persona.source_count, persona.chunk_count);
        AppLogEvent::success("OpenAIRAG", format!("🎉 Persona '{}' ready! ({} sources, {} chunks)", persona.name, persona.source_count, persona.chunk_count)).emit_to_frontend(&app_handle);

        Ok(persona)
    }

    /// Generate embeddings for chunks using OpenAI API
    async fn generate_embeddings(
        &self,
        chunks: Vec<(String, String, String, String, usize)>, // (id, text, source_id, source_name, chunk_index)
        api_key: String,
        app_handle: &tauri::AppHandle,
    ) -> Result<Vec<EmbeddedChunk>> {
        let config = OpenAIConfig::new().with_api_key(api_key);
        let client = Client::with_config(config);
        let mut embedded_chunks = Vec::new();

        // Process in batches of 100 (OpenAI limit is 2048, but we'll be conservative)
        let batch_size = 100;
        let total_batches = (chunks.len() + batch_size - 1) / batch_size;

        for (batch_idx, chunk_batch) in chunks.chunks(batch_size).enumerate() {
            tracing::info!("Processing batch {}/{}", batch_idx + 1, total_batches);
            AppLogEvent::debug("OpenAIRAG", format!("Embedding batch {}/{}", batch_idx + 1, total_batches), None).emit_to_frontend(app_handle);

            let texts: Vec<String> = chunk_batch.iter().map(|(_, text, _, _, _)| text.clone()).collect();

            let request = CreateEmbeddingRequestArgs::default()
                .model("text-embedding-3-small")
                .input(texts)
                .build()?;

            let response = client.embeddings().create(request).await?;

            for (i, embedding_data) in response.data.iter().enumerate() {
                let chunk_data: &(String, String, String, String, usize) = &chunk_batch[i];
                let (id, text, source_id, source_name, chunk_index) = chunk_data;

                // Get source type from source_id
                let source_type = if source_id.starts_with("training_transcript") {
                    "transcript"
                } else {
                    "document"
                };

                embedded_chunks.push(EmbeddedChunk {
                    id: id.clone(),
                    text: text.clone(),
                    source_id: source_id.clone(),
                    source_type: source_type.to_string(),
                    source_name: source_name.clone(),
                    chunk_index: *chunk_index,
                    embedding: embedding_data.embedding.iter().map(|&v| v as f32).collect(),
                });
            }

            // Small delay to be nice to API
            if batch_idx < total_batches - 1 {
                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
            }
        }

        Ok(embedded_chunks)
    }

    /// Chunk training item into optimal sizes for embedding
    fn chunk_training_item(&self, item: &TrainingDataItem) -> Result<Vec<(String, String, String, String, usize)>> {
        let mut chunks = Vec::new();

        // Parse JSON content
        let content_json: serde_json::Value = serde_json::from_str(&item.content)?;

        if item.source_type == "transcript" {
            // Handle transcript format - group messages into chunks
            if let Some(messages) = content_json.get("messages").and_then(|m| m.as_array()) {
                let mut chunk_text = String::new();
                let mut chunk_size = 0;
                let max_chunk_size = 500; // words

                for msg in messages {
                    if let (Some(role), Some(content)) = (
                        msg.get("role").and_then(|r| r.as_str()),
                        msg.get("content").and_then(|c| c.as_str()),
                    ) {
                        let msg_text = format!("{}: {}\n", role.to_uppercase(), content);
                        let msg_words = content.split_whitespace().count();

                        if chunk_size + msg_words > max_chunk_size && !chunk_text.is_empty() {
                            // Save current chunk
                            chunks.push((
                                format!("{}_{}", item.id, chunks.len()),
                                chunk_text.clone(),
                                item.id.clone(),
                                item.title.clone(),
                                chunks.len(),
                            ));
                            chunk_text.clear();
                            chunk_size = 0;
                        }

                        chunk_text.push_str(&msg_text);
                        chunk_size += msg_words;
                    }
                }

                // Save last chunk
                if !chunk_text.is_empty() {
                    chunks.push((
                        format!("{}_{}", item.id, chunks.len()),
                        chunk_text,
                        item.id.clone(),
                        item.title.clone(),
                        chunks.len(),
                    ));
                }
            }
        } else if item.source_type == "document" {
            // Handle document format
            if let Some(doc_chunks) = content_json.get("chunks").and_then(|c| c.as_array()) {
                for (idx, chunk) in doc_chunks.iter().enumerate() {
                    if let Some(text) = chunk.get("text").and_then(|t| t.as_str()) {
                        chunks.push((
                            format!("{}_{}", item.id, idx),
                            text.to_string(),
                            item.id.clone(),
                            item.title.clone(),
                            idx,
                        ));
                    }
                }
            }
        }

        Ok(chunks)
    }

    /// Query RAG system with semantic search
    pub async fn query(
        &self,
        persona_id: &str,
        query_text: String,
        api_key: String,
        top_k: usize,
    ) -> Result<Vec<SearchResult>> {
        tracing::info!("Querying persona {} with: {}", persona_id, query_text);

        // Load persona
        let persona_dir = self.rag_dir.join(persona_id);
        let chunks_file = persona_dir.join("chunks.json");

        if !chunks_file.exists() {
            return Err(anyhow!("Persona not found: {}", persona_id));
        }

        let chunks_json = fs::read_to_string(&chunks_file)?;
        let chunks: Vec<EmbeddedChunk> = serde_json::from_str(&chunks_json)?;

        // Generate embedding for query
        let config = OpenAIConfig::new().with_api_key(api_key);
        let client = Client::with_config(config);
        let request = CreateEmbeddingRequestArgs::default()
            .model("text-embedding-3-small")
            .input(vec![query_text])
            .build()?;

        let response = client.embeddings().create(request).await?;
        let query_embedding: Vec<f32> = response.data[0].embedding.iter().map(|&v| v as f32).collect();

        // Calculate cosine similarity for all chunks
        let mut scored_chunks: Vec<(usize, f32)> = chunks
            .iter()
            .enumerate()
            .map(|(idx, chunk)| {
                let score = Self::cosine_similarity(&query_embedding, &chunk.embedding);
                (idx, score)
            })
            .collect();

        // Sort by score descending
        scored_chunks.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        // Return top k results
        let results: Vec<SearchResult> = scored_chunks
            .iter()
            .take(top_k)
            .map(|(idx, score)| {
                let chunk = &chunks[*idx];
                SearchResult {
                    chunk_id: chunk.id.clone(),
                    text: chunk.text.clone(),
                    source_name: chunk.source_name.clone(),
                    score: *score,
                    chunk_index: chunk.chunk_index,
                }
            })
            .collect();

        tracing::info!("Found {} results, top score: {:.3}", results.len(), results.first().map(|r| r.score).unwrap_or(0.0));

        Ok(results)
    }

    /// Calculate cosine similarity between two vectors
    fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
        let a_arr = Array1::from_vec(a.to_vec());
        let b_arr = Array1::from_vec(b.to_vec());

        let dot_product = a_arr.dot(&b_arr);
        let norm_a = a_arr.dot(&a_arr).sqrt();
        let norm_b = b_arr.dot(&b_arr).sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            return 0.0;
        }

        dot_product / (norm_a * norm_b)
    }

    /// List all personas
    pub fn list_personas(&self) -> Result<Vec<OpenAIRagPersona>> {
        let mut personas = Vec::new();

        if !self.rag_dir.exists() {
            return Ok(personas);
        }

        for entry in fs::read_dir(&self.rag_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                let persona_file = path.join("persona.json");
                if persona_file.exists() {
                    if let Ok(content) = fs::read_to_string(&persona_file) {
                        if let Ok(persona) = serde_json::from_str::<OpenAIRagPersona>(&content) {
                            personas.push(persona);
                        }
                    }
                }
            }
        }

        personas.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(personas)
    }

    /// Delete a persona
    pub fn delete_persona(&self, persona_id: &str) -> Result<()> {
        let persona_dir = self.rag_dir.join(persona_id);
        if persona_dir.exists() {
            fs::remove_dir_all(&persona_dir)?;
            tracing::info!("Deleted persona: {}", persona_id);
        }
        Ok(())
    }

    /// Helper to emit progress events
    async fn emit_progress(
        &self,
        app_handle: &tauri::AppHandle,
        step: u32,
        total_steps: u32,
        percentage: u32,
        status: &str,
        details: Option<String>,
    ) {
        let event = RagProgressEvent {
            status: status.to_string(),
            step,
            total_steps,
            percentage,
            details,
        };

        if let Err(e) = app_handle.emit("rag_progress", event) {
            tracing::error!("Failed to emit progress event: {}", e);
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }
}
