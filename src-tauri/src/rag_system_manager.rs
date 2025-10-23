use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use chrono::Utc;
use uuid::Uuid;

use crate::training_data_manager::{TrainingDataManager, TrainingDataItem};

/// RAG Persona metadata
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RagPersona {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
    pub source_count: usize,
    pub chunk_count: usize,
    pub embedding_model: String,
}

/// Individual text chunk with metadata
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RagChunk {
    pub id: String,
    pub text: String,
    pub source_id: String,
    pub source_type: String, // "document" | "transcript"
    pub source_name: String,
    pub chunk_index: usize,
    pub metadata: serde_json::Value,
}

/// Source reference in RAG system
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RagSource {
    pub id: String,
    pub source_type: String,
    pub name: String,
    pub added_at: String,
}

/// Complete RAG system metadata
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RagMetadata {
    pub persona: RagPersona,
    pub sources: Vec<RagSource>,
    pub embedding_config: EmbeddingConfig,
}

/// Embedding configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmbeddingConfig {
    pub model: String,
    pub dimensions: usize,
    pub chunk_size: usize,    // words
    pub chunk_overlap: usize, // words
}

/// RAG System Manager
pub struct RagSystemManager {
    rag_systems_dir: PathBuf,
    python_script_path: PathBuf,
}

impl RagSystemManager {
    /// Create new RAG system manager
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
                base.join("rag_systems").exists()
                    || base.join("sidecar").exists()
                    || base.join("src-tauri").exists()
            })
            .unwrap_or_else(|| PathBuf::from("."));

        let rag_systems_dir = project_root.join("rag_systems");
        let python_script_path = project_root
            .join("sidecar")
            .join("python_embeddings")
            .join("embedding_service.py");

        // Create rag_systems directory if it doesn't exist
        fs::create_dir_all(&rag_systems_dir)?;

        Ok(Self {
            rag_systems_dir,
            python_script_path,
        })
    }

    /// Create a new RAG persona from training items
    pub fn create_rag_persona(
        &self,
        name: String,
        description: String,
        training_item_ids: Vec<String>,
    ) -> Result<RagPersona> {
        println!("[RAG] Creating persona: {}", name);

        // Generate unique ID
        let persona_id = Uuid::new_v4().to_string();
        let persona_dir = self.rag_systems_dir.join(&persona_id);
        fs::create_dir_all(&persona_dir)?;

        // Load training items
        let training_manager = TrainingDataManager::new()?;
        let mut all_items = Vec::new();
        for item_id in &training_item_ids {
            match training_manager.get_training_item(item_id) {
                Ok(item) => all_items.push(item),
                Err(e) => eprintln!("[RAG] Warning: Failed to load item {}: {}", item_id, e),
            }
        }

        if all_items.is_empty() {
            return Err(anyhow!("No valid training items found"));
        }

        println!("[RAG] Processing {} training items", all_items.len());

        // Process items into chunks
        let chunks = self.process_training_items(&all_items)?;
        println!("[RAG] Created {} chunks", chunks.len());

        // Extract text for embedding
        let texts: Vec<String> = chunks.iter().map(|c| c.text.clone()).collect();

        // Generate embeddings
        println!("[RAG] Generating embeddings...");
        let embeddings = self.generate_embeddings(texts)?;
        println!("[RAG] Generated {} embeddings", embeddings.len());

        // Save embeddings to temp file
        let embeddings_path = persona_dir.join("embeddings_temp.json");
        fs::write(
            &embeddings_path,
            serde_json::to_string(&embeddings)?,
        )?;

        // Create FAISS index
        println!("[RAG] Building FAISS index...");
        let index_path = persona_dir.join("index.faiss");
        self.create_faiss_index(&embeddings_path, &index_path)?;
        println!("[RAG] FAISS index created");

        // Clean up temp embeddings file
        fs::remove_file(&embeddings_path)?;

        // Save chunks
        let chunks_path = persona_dir.join("chunks.json");
        fs::write(&chunks_path, serde_json::to_string_pretty(&chunks)?)?;

        // Create sources list
        let sources: Vec<RagSource> = all_items
            .iter()
            .map(|item| RagSource {
                id: item.id.clone(),
                source_type: item.source_type.clone(),
                name: item.title.clone(),
                added_at: Utc::now().to_rfc3339(),
            })
            .collect();

        // Create persona metadata
        let persona = RagPersona {
            id: persona_id.clone(),
            name,
            description,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
            source_count: all_items.len(),
            chunk_count: chunks.len(),
            embedding_model: "all-MiniLM-L6-v2".to_string(),
        };

        // Create and save metadata
        let metadata = RagMetadata {
            persona: persona.clone(),
            sources,
            embedding_config: EmbeddingConfig {
                model: "all-MiniLM-L6-v2".to_string(),
                dimensions: 384,
                chunk_size: 300,
                chunk_overlap: 50,
            },
        };

        let metadata_path = persona_dir.join("metadata.json");
        fs::write(&metadata_path, serde_json::to_string_pretty(&metadata)?)?;

        println!("[RAG] Persona created successfully: {}", persona_id);

        Ok(persona)
    }

    /// Process training items into RAG chunks
    fn process_training_items(&self, items: &[TrainingDataItem]) -> Result<Vec<RagChunk>> {
        let mut all_chunks = Vec::new();

        for item in items {
            let chunks = self.chunk_training_item(item)?;
            all_chunks.extend(chunks);
        }

        Ok(all_chunks)
    }

    /// Chunk a single training item
    fn chunk_training_item(&self, item: &TrainingDataItem) -> Result<Vec<RagChunk>> {
        let config = EmbeddingConfig {
            model: "all-MiniLM-L6-v2".to_string(),
            dimensions: 384,
            chunk_size: 300,
            chunk_overlap: 50,
        };

        // Parse the content based on format
        let text_to_chunk = if item.format == "json" {
            self.extract_text_from_json_content(&item.content)?
        } else {
            item.content.clone()
        };

        // Chunk the text
        let text_chunks = self.chunk_text(
            text_to_chunk,
            config.chunk_size,
            config.chunk_overlap,
        );

        // Create RagChunk objects
        let mut chunks = Vec::new();
        for (idx, text) in text_chunks.into_iter().enumerate() {
            chunks.push(RagChunk {
                id: format!("{}_{}", item.id, idx),
                text,
                source_id: item.id.clone(),
                source_type: item.source_type.clone(),
                source_name: item.title.clone(),
                chunk_index: idx,
                metadata: serde_json::json!({
                    "source_date": item.metadata.source_date,
                    "added_at": item.added_at,
                }),
            });
        }

        Ok(chunks)
    }

    /// Extract text from JSON-formatted training content
    fn extract_text_from_json_content(&self, content: &str) -> Result<String> {
        let parsed: serde_json::Value = serde_json::from_str(content)?;

        // Handle different JSON structures
        if let Some(messages) = parsed.get("messages") {
            // Conversation format
            if let Some(messages_arr) = messages.as_array() {
                let texts: Vec<String> = messages_arr
                    .iter()
                    .filter_map(|msg| {
                        msg.get("content")
                            .and_then(|c| c.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect();
                return Ok(texts.join("\n\n"));
            }
        } else if let Some(chunks) = parsed.get("chunks") {
            // Document format
            if let Some(chunks_arr) = chunks.as_array() {
                let texts: Vec<String> = chunks_arr
                    .iter()
                    .filter_map(|chunk| {
                        chunk.get("text")
                            .and_then(|t| t.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect();
                return Ok(texts.join(" "));
            }
        }

        // Fallback: return original content
        Ok(content.to_string())
    }

    /// Chunk text into overlapping segments
    fn chunk_text(&self, text: String, chunk_size: usize, chunk_overlap: usize) -> Vec<String> {
        let words: Vec<&str> = text.split_whitespace().collect();
        let mut chunks = Vec::new();

        if words.is_empty() {
            return chunks;
        }

        let mut start = 0;
        while start < words.len() {
            let end = std::cmp::min(start + chunk_size, words.len());
            let chunk = words[start..end].join(" ");
            chunks.push(chunk);

            if end >= words.len() {
                break;
            }

            start = end - chunk_overlap;
        }

        chunks
    }

    /// Generate embeddings using Python service
    fn generate_embeddings(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(Vec::new());
        }

        println!("[RAG] Calling Python embedding service for {} texts", texts.len());

        let mut child = Command::new("python3")
            .arg(&self.python_script_path)
            .arg("embed")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        // Write texts to stdin
        {
            let stdin = child.stdin.as_mut()
                .ok_or_else(|| anyhow!("Failed to open stdin"))?;
            serde_json::to_writer(stdin, &texts)?;
        }

        // Wait for completion and read output
        let output = child.wait_with_output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("Embedding generation failed: {}", stderr));
        }

        let embeddings: Vec<Vec<f32>> = serde_json::from_slice(&output.stdout)?;

        Ok(embeddings)
    }

    /// Create FAISS index using Python service
    fn create_faiss_index(&self, embeddings_path: &Path, output_path: &Path) -> Result<()> {
        println!("[RAG] Creating FAISS index");

        let output = Command::new("python3")
            .arg(&self.python_script_path)
            .arg("create_index")
            .arg(embeddings_path)
            .arg(output_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("FAISS index creation failed: {}", stderr));
        }

        Ok(())
    }

    /// List all RAG personas
    pub fn list_rag_personas(&self) -> Result<Vec<RagPersona>> {
        let mut personas = Vec::new();

        if !self.rag_systems_dir.exists() {
            return Ok(personas);
        }

        for entry in fs::read_dir(&self.rag_systems_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                let metadata_path = path.join("metadata.json");
                if metadata_path.exists() {
                    match fs::read_to_string(&metadata_path) {
                        Ok(content) => {
                            match serde_json::from_str::<RagMetadata>(&content) {
                                Ok(metadata) => personas.push(metadata.persona),
                                Err(e) => eprintln!("[RAG] Failed to parse metadata: {}", e),
                            }
                        }
                        Err(e) => eprintln!("[RAG] Failed to read metadata: {}", e),
                    }
                }
            }
        }

        Ok(personas)
    }

    /// Query RAG system for relevant chunks
    pub fn query_rag(
        &self,
        persona_id: &str,
        query: String,
        top_k: usize,
    ) -> Result<Vec<RagChunk>> {
        println!("[RAG] Querying persona: {}", persona_id);

        let persona_dir = self.rag_systems_dir.join(persona_id);
        if !persona_dir.exists() {
            return Err(anyhow!("Persona not found: {}", persona_id));
        }

        // Generate query embedding
        let query_embeddings = self.generate_embeddings(vec![query])?;
        let query_embedding = query_embeddings
            .into_iter()
            .next()
            .ok_or_else(|| anyhow!("No embedding generated for query"))?;

        // Save query embedding to temp file
        let query_path = persona_dir.join("temp_query.json");
        fs::write(&query_path, serde_json::to_string(&query_embedding)?)?;

        // Search FAISS index
        let index_path = persona_dir.join("index.faiss");
        let results = self.search_faiss_index(&index_path, &query_path, top_k)?;

        // Clean up temp file
        fs::remove_file(&query_path)?;

        // Load chunks
        let chunks_path = persona_dir.join("chunks.json");
        let all_chunks: Vec<RagChunk> = serde_json::from_str(&fs::read_to_string(&chunks_path)?)?;

        // Return top-k chunks
        let mut result_chunks = Vec::new();
        for idx in results.indices {
            if let Some(chunk) = all_chunks.get(idx) {
                result_chunks.push(chunk.clone());
            }
        }

        println!("[RAG] Found {} relevant chunks", result_chunks.len());

        Ok(result_chunks)
    }

    /// Search FAISS index using Python service
    fn search_faiss_index(
        &self,
        index_path: &Path,
        query_path: &Path,
        top_k: usize,
    ) -> Result<SearchResults> {
        let output = Command::new("python3")
            .arg(&self.python_script_path)
            .arg("search")
            .arg(index_path)
            .arg(query_path)
            .arg(top_k.to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("FAISS search failed: {}", stderr));
        }

        let results: SearchResults = serde_json::from_slice(&output.stdout)?;
        Ok(results)
    }

    /// Delete a RAG persona
    pub fn delete_rag_persona(&self, persona_id: &str) -> Result<()> {
        let persona_dir = self.rag_systems_dir.join(persona_id);

        if !persona_dir.exists() {
            return Err(anyhow!("Persona not found: {}", persona_id));
        }

        fs::remove_dir_all(&persona_dir)?;
        println!("[RAG] Deleted persona: {}", persona_id);

        Ok(())
    }

    /// Get RAG persona by ID
    pub fn get_rag_persona(&self, persona_id: &str) -> Result<RagPersona> {
        let metadata_path = self.rag_systems_dir.join(persona_id).join("metadata.json");

        if !metadata_path.exists() {
            return Err(anyhow!("Persona not found: {}", persona_id));
        }

        let content = fs::read_to_string(&metadata_path)?;
        let metadata: RagMetadata = serde_json::from_str(&content)?;

        Ok(metadata.persona)
    }
}

#[derive(Debug, Deserialize)]
struct SearchResults {
    indices: Vec<usize>,
    #[allow(dead_code)]
    distances: Vec<f32>,
}
