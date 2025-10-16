use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileInfo {
    pub id: String,                    // UUID for unique identification
    pub name: String,                  // Original filename
    pub file_type: String,             // File extension (txt, py, etc.)
    pub size: u64,                     // File size in bytes
    pub upload_date: String,           // ISO 8601 timestamp
    pub content: String,               // Extracted text content
    pub is_context_enabled: bool,      // Toggle for LLM context
    #[serde(default)]
    pub summary: String,               // Brief summary for prompts
    #[serde(default)]
    pub conversation_id: Option<String>, // Optional associated conversation id
}

pub struct FileStorage {
    uploads_dir: PathBuf,              // ./uploads/ directory path
    index_path: PathBuf,               // ./uploads/index.json path
}

impl FileStorage {
    pub fn new() -> Result<Self> {
        // Determine a stable project root so we point at the same uploads dir as the Node sidecar
        fn candidates() -> Vec<PathBuf> {
            let mut v: Vec<PathBuf> = Vec::new();
            // Highest precedence: explicit override
            if let Ok(dir) = std::env::var("ARKANGEL_PROJECT_ROOT") {
                v.push(PathBuf::from(dir));
            }
            // Try compile-time src-tauri path parent (dev builds)
            let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            if let Some(p) = manifest_dir.parent() { v.push(p.to_path_buf()); }
            // Current dir and its parents
            if let Ok(cd) = std::env::current_dir() {
                v.push(cd.clone());
                if let Some(p) = cd.parent() { v.push(p.to_path_buf()); }
                if let Some(pp) = cd.parent().and_then(|p| p.parent()) { v.push(pp.to_path_buf()); }
            }
            // Around the executable path (packaged builds)
            if let Ok(exe) = std::env::current_exe() {
                let mut p = exe.parent();
                for _ in 0..5 {
                    if let Some(pp) = p { v.push(pp.to_path_buf()); p = pp.parent(); } else { break; }
                }
            }
            v
        }

        let mut chosen_root: Option<PathBuf> = None;
        for base in candidates() {
            // Choose a directory that already contains expected repo markers or uploads
            if base.join("uploads").exists() || base.join("sidecar").exists() || base.join("src-tauri").exists() {
                chosen_root = Some(base);
                break;
            }
        }
        let project_root = chosen_root.unwrap_or_else(|| PathBuf::from("."));

        let uploads_dir = project_root.join("uploads");
        let index_path = uploads_dir.join("index.json");
        
        // Create uploads directory if it doesn't exist
        fs::create_dir_all(&uploads_dir)?;
        
        Ok(Self {
            uploads_dir,
            index_path,
        })
    }
    
    pub fn upload_file(&self, file_data: Vec<u8>, filename: String) -> Result<FileInfo> {
        // 1. Generate unique UUID
        let file_id = Uuid::new_v4().to_string();
        
        // 2. Determine file type from extension
        let file_type = self.get_file_type(&filename);
        
        // 3. Create file path with UUID
        let file_path = self.uploads_dir.join(&file_id);
        
        // 4. Write raw file data
        let file_size = file_data.len() as u64;
        fs::write(&file_path, &file_data)?;
        
        // 5. Extract text content based on file type
        let content = self.extract_text_content(&file_path, &file_type)?;
        
        // 6. Create metadata record (compute brief summary)
        let summary = Self::summarize(&filename, &file_type, file_size, &content);
        println!("[uploads] New file uploaded: name='{}' type='{}' size={} id={} summary='{}'", filename, file_type, file_size, file_id, summary);
        
        let file_info = FileInfo {
            id: file_id,
            name: filename,
            file_type,
            size: file_size,
            upload_date: Utc::now().to_rfc3339(),
            content,
            is_context_enabled: true, // Default to enabled
            summary,
            conversation_id: None,
        };
        
        // 7. Save to JSON index
        self.save_file_to_index(&file_info)?;
        
        Ok(file_info)
    }
    
    fn get_file_type(&self, filename: &str) -> String {
        Path::new(filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("unknown")
            .to_lowercase()
    }
    
    fn extract_text_content(&self, file_path: &Path, file_type: &str) -> Result<String> {
        match file_type {
            // Text files - direct read
            "txt" | "md" | "json" | "csv" | "xml" | "yaml" | "log" => {
                let content = fs::read_to_string(file_path)?;
                Ok(content)
            }
            // Code files - direct read with syntax preservation
            "py" | "js" | "ts" | "java" | "cpp" | "c" | "go" | "rs" | "php" | "html" | "css" | "sql" => {
                let content = fs::read_to_string(file_path)?;
                Ok(content)
            }
            // PDF files - extract text content
            "pdf" => {
                self.extract_pdf_text(file_path)
            }
            // Unsupported types - return empty (future: DOCX, OCR)
            _ => {
                Ok("".to_string())
            }
        }
    }
    
    /// Extract text content from PDF files using pdf-extract crate
    fn extract_pdf_text(&self, file_path: &Path) -> Result<String> {
        // Read the PDF file as bytes
        let pdf_bytes = fs::read(file_path)?;
        
        // Extract text using pdf-extract
        match pdf_extract::extract_text_from_mem(&pdf_bytes) {
            Ok(text) => {
                // Clean up the extracted text
                let cleaned_text = text
                    .lines()
                    .map(|line| line.trim())
                    .filter(|line| !line.is_empty())
                    .collect::<Vec<_>>()
                    .join("\n");
                
                Ok(cleaned_text)
            }
            Err(e) => {
                // If PDF extraction fails, return a helpful error message
                Err(anyhow!("Failed to extract text from PDF: {}", e))
            }
        }
    }
    
    fn save_file_to_index(&self, new_file: &FileInfo) -> Result<()> {
        let mut files = self.list_files()?;
        
        // Check if file already exists and update it, otherwise add new
        let existing_index = files.iter().position(|f| f.id == new_file.id);
        match existing_index {
            Some(index) => {
                files[index] = new_file.clone();
            }
            None => {
                files.push(new_file.clone());
            }
        }
        
        self.save_index(&files)
    }
    
    fn save_index(&self, files: &[FileInfo]) -> Result<()> {
        // Serialize to pretty JSON for human readability
        let index_content = serde_json::to_string_pretty(files)?;
        fs::write(&self.index_path, index_content)?;
        Ok(())
    }
    
    pub fn list_files(&self) -> Result<Vec<FileInfo>> {
        if !self.index_path.exists() {
            return Ok(vec![]);
        }
        
        let index_content = fs::read_to_string(&self.index_path)?;
        let mut files: Vec<FileInfo> = serde_json::from_str(&index_content)?;
        
        // Backfill summaries for older entries missing the new field
        let mut changed = false;
        for f in files.iter_mut() {
            if f.summary.trim().is_empty() {
                f.summary = Self::summarize(&f.name, &f.file_type, f.size, &f.content);
                println!("[uploads] Backfilled summary for id={} name='{}' => '{}'", f.id, f.name, f.summary);
                changed = true;
            }
        }
        if changed {
            self.save_index(&files)?;
        }
        
        Ok(files)
    }
    
    pub fn delete_file(&self, file_id: &str) -> Result<()> {
        println!("[FileStorage] Attempting to delete file: {}", file_id);
        let mut files = self.list_files()?;
        println!("[FileStorage] Current file count: {}", files.len());
        
        // Find and remove the file
        if let Some(index) = files.iter().position(|f| f.id == file_id) {
            println!("[FileStorage] Found file at index: {}", index);
            
            // Remove the file from filesystem
            let file_path = self.uploads_dir.join(file_id);
            println!("[FileStorage] Attempting to delete file at path: {:?}", file_path);
            
            if file_path.exists() {
                fs::remove_file(&file_path)
                    .map_err(|e| anyhow!("Failed to remove file from filesystem: {}", e))?;
                println!("[FileStorage] Successfully removed file from filesystem");
            } else {
                println!("[FileStorage] Warning: File not found on filesystem: {:?}", file_path);
            }
            
            // Remove from index
            files.remove(index);
            self.save_index(&files)?;
            println!("[FileStorage] Successfully removed file from index. New count: {}", files.len());
        } else {
            println!("[FileStorage] Error: File with ID {} not found in index", file_id);
            return Err(anyhow!("File not found: {}", file_id));
        }
        
        Ok(())
    }

    /// Delete all files associated with a conversation id. Returns number deleted.
    pub fn delete_files_by_conversation(&self, conversation_id: &str) -> Result<usize> {
        let mut files = self.list_files()?;

        // Determine which files to delete
        let to_delete: Vec<FileInfo> = files
            .iter()
            .cloned()
            .filter(|f| f.conversation_id.as_deref() == Some(conversation_id))
            .collect();

        // Remove files from filesystem
        for f in &to_delete {
            let file_path = self.uploads_dir.join(&f.id);
            if file_path.exists() {
                let _ = fs::remove_file(&file_path);
            }
        }

        // Keep only remaining files in index
        files.retain(|f| f.conversation_id.as_deref() != Some(conversation_id));
        self.save_index(&files)?;

        Ok(to_delete.len())
    }

    /// Count files associated with a conversation id.
    pub fn count_files_by_conversation(&self, conversation_id: &str) -> Result<usize> {
        let files = self.list_files()?;
        Ok(files
            .iter()
            .filter(|f| f.conversation_id.as_deref() == Some(conversation_id))
            .count())
    }

    /// Link all currently context-enabled files to a conversation id. Returns number updated.
    pub fn link_enabled_files_to_conversation(&self, conversation_id: &str) -> Result<usize> {
        let mut files = self.list_files()?;
        let mut updated = 0usize;
        for f in files.iter_mut() {
            if f.is_context_enabled {
                if f.conversation_id.as_deref() != Some(conversation_id) {
                    f.conversation_id = Some(conversation_id.to_string());
                    updated += 1;
                }
            }
        }
        if updated > 0 {
            self.save_index(&files)?;
        }
        Ok(updated)
    }

    /// Delete all uploaded files and clear the index
    pub fn wipe_all(&self) -> Result<()> {
        println!("[FileStorage] Starting wipe_all operation");
        
        // Remove all files in uploads_dir except the index.json itself
        if self.uploads_dir.exists() {
            let mut deleted_count = 0;
            for entry in fs::read_dir(&self.uploads_dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_file() {
                    // Keep index.json handling for last
                    if path.file_name().and_then(|n| n.to_str()) == Some("index.json") {
                        continue;
                    }
                    match fs::remove_file(&path) {
                        Ok(_) => {
                            deleted_count += 1;
                            println!("[FileStorage] Deleted file: {:?}", path);
                        }
                        Err(e) => {
                            println!("[FileStorage] Failed to delete file {:?}: {}", path, e);
                        }
                    }
                }
            }
            println!("[FileStorage] Deleted {} files from filesystem", deleted_count);
        }

        // Clear index.json to an empty array
        self.save_index(&[])?;
        println!("[FileStorage] Cleared file index");
        Ok(())
    }
    
    pub fn toggle_context(&self, file_id: &str) -> Result<FileInfo> {
        let mut files = self.list_files()?;
        
        if let Some(index) = files.iter().position(|f| f.id == file_id) {
            files[index].is_context_enabled = !files[index].is_context_enabled;
            let file_info = files[index].clone();
            self.save_index(&files)?;
            Ok(file_info)
        } else {
            Err(anyhow!("File not found: {}", file_id))
        }
    }
    
    pub fn get_context_content(&self) -> Result<Vec<String>> {
        let files = self.list_files()?;
        
        // Filter enabled files and extract content
        let context_content: Vec<String> = files
            .iter()
            .filter(|f| f.is_context_enabled)
            .map(|f| format!("File: {}\nContent:\n{}", f.name, f.content))
            .collect();
        
        Ok(context_content)
    }

    /// Store file from path with robust content extraction
    pub fn store_file_from_path_robust(
        &self,
        source_path: &str,
        filename: &str,
        file_type: &str,
    ) -> Result<FileInfo> {
        println!(
            "[FileStorage] Storing file from path: source={}, filename={}, type={}",
            source_path, filename, file_type
        );

        // 1. Generate unique UUID
        let file_id = Uuid::new_v4().to_string();
        println!("[FileStorage] Generated file ID: {}", file_id);

        // 2. Create destination file path with UUID
        let dest_path = self.uploads_dir.join(&file_id);

        // 3. Copy the file
        fs::copy(source_path, &dest_path)
            .map_err(|e| anyhow!("Failed to copy file: {}", e))?;

        // 4. Get file size
        let file_size = fs::metadata(&dest_path)?.len();

        // 5. Try to extract content based on file type with graceful fallback
        let (content, summary) = match file_type {
            "pdf" => match self.extract_pdf_text(&dest_path) {
                Ok(text) => {
                    let cleaned_text = if text.len() > 10000 {
                        format!(
                            "{}... [Truncated - {} characters total]",
                            &text[..10000],
                            text.len()
                        )
                    } else {
                        text
                    };
                    let summary = format!(
                        "PDF document: {} [{} bytes] - Text extracted: {} chars",
                        filename, file_size, cleaned_text.len()
                    );
                    (cleaned_text, summary)
                }
                Err(e) => {
                    let summary = format!(
                        "PDF document: {} [{} bytes] - Content extraction failed: {}",
                        filename, file_size, e
                    );
                    (String::new(), summary)
                }
            },
            "txt" | "md" | "json" | "csv" | "xml" | "yaml" | "yml" | "log" | "rtf" => {
                match fs::read_to_string(&dest_path) {
                    Ok(text) => {
                        let cleaned_text = if text.len() > 10000 {
                            format!(
                                "{}... [Truncated - {} characters total]",
                                &text[..10000],
                                text.len()
                            )
                        } else {
                            text
                        };
                        let summary = format!(
                            "Text document: {} [{} bytes] - Content extracted: {} chars",
                            filename, file_size, cleaned_text.len()
                        );
                        (cleaned_text, summary)
                    }
                    Err(e) => {
                        let summary = format!(
                            "Text document: {} [{} bytes] - Content extraction failed: {}",
                            filename, file_size, e
                        );
                        (String::new(), summary)
                    }
                }
            }
            "py" | "js" | "ts" | "jsx" | "tsx" | "java" | "cpp" | "c" | "cc" | "cxx" | "h"
            | "hpp" | "go" | "rs" | "php" | "rb" | "swift" | "kt" | "scala" | "html" | "htm"
            | "css" | "scss" | "sass" | "less" | "sql" | "sh" | "bash" | "zsh" | "fish" | "ps1"
            | "bat" | "cmd" => {
                // Code files - direct read with syntax preservation
                match fs::read_to_string(&dest_path) {
                    Ok(text) => {
                        let cleaned_text = if text.len() > 10000 {
                            format!(
                                "{}... [Truncated - {} characters total]",
                                &text[..10000],
                                text.len()
                            )
                        } else {
                            text
                        };
                        let summary = format!(
                            "Code file: {} [{} bytes] - Content extracted: {} chars",
                            filename, file_size, cleaned_text.len()
                        );
                        (cleaned_text, summary)
                    }
                    Err(e) => {
                        let summary = format!(
                            "Code file: {} [{} bytes] - Content extraction failed: {}",
                            filename, file_size, e
                        );
                        (String::new(), summary)
                    }
                }
            }
            "png" | "jpg" | "jpeg" | "gif" | "bmp" | "svg" | "webp" => {
                let summary = format!(
                    "Image file: {} [{} bytes] - Binary content not extractable",
                    filename, file_size
                );
                (String::new(), summary)
            }
            "mp4" | "avi" | "mov" | "wmv" | "flv" | "webm" | "mkv" => {
                let summary = format!(
                    "Video file: {} [{} bytes] - Binary content not extractable",
                    filename, file_size
                );
                (String::new(), summary)
            }
            "mp3" | "wav" | "flac" | "aac" | "ogg" => {
                let summary = format!(
                    "Audio file: {} [{} bytes] - Binary content not extractable",
                    filename, file_size
                );
                (String::new(), summary)
            }
            "zip" | "rar" | "7z" | "tar" | "gz" => {
                let summary = format!(
                    "Archive file: {} [{} bytes] - Binary content not extractable",
                    filename, file_size
                );
                (String::new(), summary)
            }
            _ => {
                let summary = format!(
                    "Unknown file type: {} [{} bytes] - Binary content not extractable",
                    filename, file_size
                );
                (String::new(), summary)
            }
        };

        let file_info = FileInfo {
            id: file_id,
            name: filename.to_string(),
            file_type: file_type.to_string(),
            size: file_size,
            upload_date: Utc::now().to_rfc3339(),
            content,
            is_context_enabled: true, // Default to enabled
            summary,
            conversation_id: None,
        };

        // 6. Save to JSON index
        let mut files = self.list_files().unwrap_or_else(|_| vec![]);
        files.push(file_info.clone());
        self.save_index(&files)?;

        println!(
            "[FileStorage] Successfully stored file: {} ({} bytes)",
            file_info.name, file_info.size
        );

        Ok(file_info)
    }

    /// Get file type from filename
    pub fn get_file_type_from_name(filename: &str) -> String {
        Path::new(filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("unknown")
            .to_lowercase()
    }

    /// Extract content from a specific file by ID (on-demand extraction)
    pub fn extract_file_content(&self, file_id: &str) -> Result<String> {
        let files = self.list_files()?;
        let file_info = files
            .iter()
            .find(|f| f.id == file_id)
            .ok_or_else(|| anyhow!("File not found: {}", file_id))?;

        let file_path = self.uploads_dir.join(file_id);
        
        if !file_path.exists() {
            return Err(anyhow!("File not found on filesystem: {:?}", file_path));
        }

        // Extract content based on file type
        match file_info.file_type.as_str() {
            "pdf" => self.extract_pdf_text(&file_path),
            "txt" | "md" | "json" | "csv" | "xml" | "yaml" | "yml" | "log" | "rtf" => {
                fs::read_to_string(&file_path).map_err(|e| anyhow!("Failed to read text file: {}", e))
            }
            "py" | "js" | "ts" | "jsx" | "tsx" | "java" | "cpp" | "c" | "go" | "rs" | "php" 
            | "html" | "css" | "sql" => {
                fs::read_to_string(&file_path).map_err(|e| anyhow!("Failed to read code file: {}", e))
            }
            _ => {
                // For binary files, return empty string
                Ok(String::new())
            }
        }
    }

    /// Get optimized context content for AI conversations
    /// This implements smart chunking and summarization strategies
    /// Content is extracted on-demand to avoid parsing during upload
    pub fn get_optimized_context(&self) -> Result<Vec<String>, String> {
        let files = self
            .list_files()
            .map_err(|e| format!("Failed to list files: {}", e))?;

        let mut context_content: Vec<String> = Vec::new();

        // Filter enabled files and create optimized context
        for file in files.iter().filter(|f| f.is_context_enabled) {
            // Extract content on-demand
            match self.extract_file_content(&file.id) {
                Ok(content) => {
                    if content.is_empty() {
                        // Skip empty files
                        continue;
                    }

                    // Use smart chunking for large documents
                    if content.len() > 2000 {
                        let chunks = Self::create_smart_chunks(&file.name, &content);
                        context_content.extend(chunks);
                    } else {
                        context_content
                            .push(format!("Document: {}\nContent:\n{}", file.name, content));
                    }
                }
                Err(e) => {
                    println!(
                        "[FileStorage] Failed to extract content for {}: {}",
                        file.name, e
                    );
                    // Add file info even if content extraction fails
                    context_content.push(format!(
                        "Document: {} [Content extraction failed: {}]",
                        file.name, e
                    ));
                }
            }
        }

        Ok(context_content)
    }

    /// Create smart chunks for large documents
    /// Implements sliding window approach with overlap
    fn create_smart_chunks(filename: &str, content: &str) -> Vec<String> {
        const CHUNK_SIZE: usize = 1500; // Optimal for most LLMs
        const OVERLAP_SIZE: usize = 200; // Overlap to maintain context

        let words: Vec<&str> = content.split_whitespace().collect();
        let mut chunks = Vec::new();

        if words.len() <= CHUNK_SIZE {
            // Small document, return as single chunk
            return vec![format!("Document: {}\nContent:\n{}", filename, content)];
        }

        let mut start = 0;
        let mut chunk_num = 1;

        while start < words.len() {
            let end = std::cmp::min(start + CHUNK_SIZE, words.len());
            let chunk_words = &words[start..end];
            let chunk_content = chunk_words.join(" ");

            let chunk_title = if words.len() > CHUNK_SIZE {
                format!(
                    "Document: {} (Part {}/{})",
                    filename,
                    chunk_num,
                    (words.len() + CHUNK_SIZE - OVERLAP_SIZE - 1) / (CHUNK_SIZE - OVERLAP_SIZE)
                )
            } else {
                format!("Document: {}", filename)
            };

            chunks.push(format!("{}\nContent:\n{}", chunk_title, chunk_content));

            // Move start position with overlap
            start = end.saturating_sub(OVERLAP_SIZE);
            chunk_num += 1;

            // Prevent infinite loop
            if start == end {
                break;
            }
        }

        chunks
    }
}

impl FileStorage {
    fn summarize(name: &str, file_type: &str, size: u64, content: &str) -> String {
        // Non-LLM, cheap summary: header + trimmed snippet
        let mut snippet = content.trim();
        if snippet.len() > 400 {
            snippet = &snippet[..400];
        }
        let cleaned = snippet
            .replace('\r', " ")
            .replace('\n', " ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        format!("{} [{} | {} bytes] — {}", name, file_type, size, cleaned)
    }
}
