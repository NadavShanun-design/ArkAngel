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
}

pub struct FileStorage {
    uploads_dir: PathBuf,              // ./uploads/ directory path
    index_path: PathBuf,               // ./uploads/index.json path
}

impl FileStorage {
    pub fn new() -> Result<Self> {
        // Get the project root directory (one level up from src-tauri)
        let project_root = std::env::current_dir()?
            .parent()
            .ok_or_else(|| anyhow!("Failed to get project root"))?
            .to_path_buf();
        
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
        let mut files = self.list_files()?;
        
        // Find and remove the file
        if let Some(index) = files.iter().position(|f| f.id == file_id) {
            // Remove the file from filesystem
            let file_path = self.uploads_dir.join(file_id);
            if file_path.exists() {
                fs::remove_file(&file_path)?;
            }
            
            // Remove from index
            files.remove(index);
            self.save_index(&files)?;
        }
        
        Ok(())
    }

    /// Delete all uploaded files and clear the index
    pub fn wipe_all(&self) -> Result<()> {
        // Remove all files in uploads_dir except the index.json itself
        if self.uploads_dir.exists() {
            for entry in fs::read_dir(&self.uploads_dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_file() {
                    // Keep index.json handling for last
                    if path.file_name().and_then(|n| n.to_str()) == Some("index.json") {
                        continue;
                    }
                    let _ = fs::remove_file(&path);
                }
            }
        }

        // Clear index.json to an empty array
        self.save_index(&[])
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
