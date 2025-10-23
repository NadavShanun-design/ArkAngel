use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranscriptFile {
    pub filename: String,
    pub date: String, // YYYY-MM-DD
    pub time: String, // HH:MM:SS
    pub session_id: String,
    pub message_count: usize,
    pub file_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranscriptBatch {
    pub id: String,
    pub title: String, // First few words
    pub content: String,
    pub sentence_count: usize,
    pub batch_index: usize,
    pub total_batches: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatchedTranscript {
    pub file_info: TranscriptFile,
    pub batches: Vec<TranscriptBatch>,
    pub total_content: String,
}

pub struct TranscriptManager {
    transcripts_dir: PathBuf,
}

impl TranscriptManager {
    pub fn new() -> Result<Self> {
        // Find project root (similar to file_storage.rs logic)
        let mut candidates: Vec<PathBuf> = Vec::new();

        // Try environment variable first
        if let Ok(dir) = std::env::var("ARKANGEL_PROJECT_ROOT") {
            candidates.push(PathBuf::from(dir));
        }

        // Try compile-time manifest dir parent
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        if let Some(p) = manifest_dir.parent() {
            candidates.push(p.to_path_buf());
        }

        // Current dir and its parents
        if let Ok(cd) = std::env::current_dir() {
            candidates.push(cd.clone());
            if let Some(p) = cd.parent() {
                candidates.push(p.to_path_buf());
            }
        }

        // Around the executable path
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

        // Choose a directory that contains expected markers
        let project_root = candidates
            .into_iter()
            .find(|base| {
                base.join("transcripts").exists()
                    || base.join("sidecar").exists()
                    || base.join("src-tauri").exists()
            })
            .unwrap_or_else(|| PathBuf::from("."));

        let transcripts_dir = project_root.join("transcripts");

        // Create transcripts directory if it doesn't exist
        fs::create_dir_all(&transcripts_dir)?;

        Ok(Self { transcripts_dir })
    }

    /// List all transcript files across all date directories
    pub fn list_transcripts(&self) -> Result<Vec<TranscriptFile>> {
        let mut transcripts: Vec<TranscriptFile> = Vec::new();

        if !self.transcripts_dir.exists() {
            return Ok(transcripts);
        }

        // Read all date directories
        for entry in fs::read_dir(&self.transcripts_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                let date_str = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                // Read transcript files in this date directory
                for file_entry in fs::read_dir(&path)? {
                    let file_entry = file_entry?;
                    let file_path = file_entry.path();

                    if file_path.extension().and_then(|e| e.to_str()) == Some("txt")
                        && file_path.is_file()
                    {
                        let filename = file_path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("unknown")
                            .to_string();

                        // Parse filename: transcript_HH-MM-SS_sessionid.txt
                        let (time, session_id) = Self::parse_filename(&filename);

                        // Count messages by reading the file (quick parse)
                        let message_count = Self::count_messages(&file_path)?;

                        transcripts.push(TranscriptFile {
                            filename: filename.clone(),
                            date: date_str.clone(),
                            time,
                            session_id,
                            message_count,
                            file_path: file_path.to_string_lossy().to_string(),
                        });
                    }
                }
            }
        }

        // Sort by date and time (newest first)
        transcripts.sort_by(|a, b| {
            let date_cmp = b.date.cmp(&a.date);
            if date_cmp == std::cmp::Ordering::Equal {
                b.time.cmp(&a.time)
            } else {
                date_cmp
            }
        });

        Ok(transcripts)
    }

    /// Read a specific transcript file and return its content
    pub fn read_transcript(&self, date: &str, filename: &str) -> Result<String> {
        let file_path = self.transcripts_dir.join(date).join(filename);

        if !file_path.exists() {
            return Err(anyhow!("Transcript file not found: {:?}", file_path));
        }

        let content = fs::read_to_string(&file_path)?;
        Ok(content)
    }

    /// Read a transcript and batch it into chunks
    pub fn read_and_batch_transcript(
        &self,
        date: &str,
        filename: &str,
        sentences_per_batch: usize,
    ) -> Result<BatchedTranscript> {
        let content = self.read_transcript(date, filename)?;
        let file_info = self.get_transcript_info(date, filename)?;

        // Extract the conversation content (skip headers and footers)
        let conversation_content = Self::extract_conversation_content(&content);

        // Batch the content
        let batches = Self::batch_content(&conversation_content, sentences_per_batch);

        Ok(BatchedTranscript {
            file_info,
            batches,
            total_content: conversation_content,
        })
    }

    /// Delete a transcript file
    pub fn delete_transcript(&self, date: &str, filename: &str) -> Result<()> {
        let file_path = self.transcripts_dir.join(date).join(filename);

        if !file_path.exists() {
            return Err(anyhow!("Transcript file not found: {:?}", file_path));
        }

        fs::remove_file(&file_path)?;
        println!("[TranscriptManager] Deleted: {:?}", file_path);
        Ok(())
    }

    /// Get transcript info without reading full content
    fn get_transcript_info(&self, date: &str, filename: &str) -> Result<TranscriptFile> {
        let file_path = self.transcripts_dir.join(date).join(filename);

        if !file_path.exists() {
            return Err(anyhow!("Transcript file not found: {:?}", file_path));
        }

        let (time, session_id) = Self::parse_filename(filename);
        let message_count = Self::count_messages(&file_path)?;

        Ok(TranscriptFile {
            filename: filename.to_string(),
            date: date.to_string(),
            time,
            session_id,
            message_count,
            file_path: file_path.to_string_lossy().to_string(),
        })
    }

    /// Parse filename to extract time and session ID
    fn parse_filename(filename: &str) -> (String, String) {
        // Format: transcript_HH-MM-SS_sessionid.txt
        let parts: Vec<&str> = filename.trim_end_matches(".txt").split('_').collect();

        let time = if parts.len() > 1 {
            parts[1].replace('-', ":")
        } else {
            "00:00:00".to_string()
        };

        let session_id = if parts.len() > 2 {
            parts[2].to_string()
        } else {
            "unknown".to_string()
        };

        (time, session_id)
    }

    /// Count messages in a transcript file
    fn count_messages(file_path: &Path) -> Result<usize> {
        let content = fs::read_to_string(file_path)?;

        // Count lines that start with timestamps (indicate message starts)
        let count = content
            .lines()
            .filter(|line| {
                let trimmed = line.trim();
                trimmed.starts_with('[') && (trimmed.contains("USER:") || trimmed.contains("AI:"))
            })
            .count();

        Ok(count)
    }

    /// Extract conversation content (remove headers/footers)
    fn extract_conversation_content(full_content: &str) -> String {
        let lines: Vec<&str> = full_content.lines().collect();
        let mut content_lines: Vec<&str> = Vec::new();
        let mut in_conversation = false;

        for line in lines {
            let trimmed = line.trim();

            // Start after the header section
            if trimmed.starts_with("Total Messages:") {
                in_conversation = true;
                continue;
            }

            // Stop at footer
            if trimmed.starts_with("END OF CONVERSATION") {
                break;
            }

            // Skip separator lines
            if trimmed.starts_with("===") {
                continue;
            }

            if in_conversation && !trimmed.is_empty() {
                content_lines.push(line);
            }
        }

        content_lines.join("\n")
    }

    /// Batch content into chunks based on sentence count
    fn batch_content(content: &str, sentences_per_batch: usize) -> Vec<TranscriptBatch> {
        let mut batches: Vec<TranscriptBatch> = Vec::new();

        // Split into sentences (simple approach: split on . ! ?)
        let sentences: Vec<String> = Self::split_into_sentences(content);

        if sentences.is_empty() {
            return batches;
        }

        let total_batches = (sentences.len() + sentences_per_batch - 1) / sentences_per_batch;
        let mut batch_index = 0;

        for chunk in sentences.chunks(sentences_per_batch) {
            let batch_content = chunk.join(" ");
            let sentence_count = chunk.len();

            // Generate title from first few words (up to 5 words)
            let title = Self::generate_title(&batch_content, 5);

            // Generate unique batch ID
            let batch_id = format!("batch_{}", batch_index);

            batches.push(TranscriptBatch {
                id: batch_id,
                title,
                content: batch_content,
                sentence_count,
                batch_index,
                total_batches,
            });

            batch_index += 1;
        }

        batches
    }

    /// Split text into sentences
    fn split_into_sentences(text: &str) -> Vec<String> {
        let mut sentences: Vec<String> = Vec::new();
        let mut current_sentence = String::new();

        for ch in text.chars() {
            current_sentence.push(ch);

            // End of sentence markers
            if ch == '.' || ch == '!' || ch == '?' {
                let trimmed = current_sentence.trim().to_string();
                if !trimmed.is_empty() && trimmed.len() > 3 {
                    // Avoid single-char sentences
                    sentences.push(trimmed);
                    current_sentence.clear();
                }
            }
        }

        // Add remaining content as final sentence if not empty
        let trimmed = current_sentence.trim().to_string();
        if !trimmed.is_empty() {
            sentences.push(trimmed);
        }

        sentences
    }

    /// Generate title from first N words
    fn generate_title(content: &str, max_words: usize) -> String {
        let words: Vec<&str> = content.split_whitespace().collect();

        let title_words: Vec<&str> = words.iter().take(max_words).copied().collect();

        let mut title = title_words.join(" ");

        // Add ellipsis if there are more words
        if words.len() > max_words {
            title.push_str("...");
        }

        // Clean up timestamp patterns and speaker labels
        title = title.replace("[", "").replace("]", "");

        // Remove USER:/AI: labels if present
        for label in &["USER:", "AI:", "user:", "ai:"] {
            title = title.replace(label, "");
        }

        title.trim().to_string()
    }
}
