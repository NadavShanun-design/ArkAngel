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
}

pub struct FileStorage {
    uploads_dir: PathBuf,              // ./uploads/ directory path
    index_path: PathBuf,               // ./uploads/index.json path
}

impl FileStorage {
    pub fn new() -> Result<Self> {
        // Use app data directory instead of project directory to avoid Tauri watch conflicts
        let app_data_dir = dirs::data_dir()
            .ok_or_else(|| anyhow!("Failed to get app data directory"))?
            .join("ArkAngel")
            .join("uploads");
        
        let index_path = app_data_dir.join("index.json");
        
        // Create uploads directory if it doesn't exist
        if !app_data_dir.exists() {
            fs::create_dir_all(&app_data_dir)?;
        }
        
        Ok(FileStorage {
            uploads_dir: app_data_dir,
            index_path,
        })
    }
    
    pub fn upload_file(&self, file_data: Vec<u8>, filename: String) -> Result<FileInfo> {
        println!("[FILE_STORAGE] Starting upload for file: {}", filename);
        
        // 1. Generate unique UUID
        let file_id = Uuid::new_v4().to_string();
        println!("[FILE_STORAGE] Generated file ID: {}", file_id);
        
        // 2. Determine file type from extension
        let file_type = self.get_file_type(&filename);
        println!("[FILE_STORAGE] Detected file type: {}", file_type);
        
        // 3. Create file path with UUID but preserve extension for proper detection
        let file_path = self.uploads_dir.join(format!("{}.{}", &file_id, &file_type));
        println!("[FILE_STORAGE] File will be stored at: {:?}", file_path);
        
        // 4. Write raw file data
        let file_size = file_data.len() as u64;
        fs::write(&file_path, &file_data)?;
        println!("[FILE_STORAGE] Wrote {} bytes to file", file_size);
        
        // 5. Extract text content based on file type
        let content = self.extract_text_content(&file_path, &file_type)?;
        println!("[FILE_STORAGE] Extracted content length: {} chars", content.len());
        
        // 6. Create metadata record
        let file_info = FileInfo {
            id: file_id,
            name: filename.clone(),
            file_type,
            size: file_size,
            upload_date: Utc::now().to_rfc3339(),
            content,
            is_context_enabled: true, // Default to enabled
        };
        
        // 7. Save to JSON index
        self.save_file_to_index(&file_info)?;
        println!("[FILE_STORAGE] Successfully uploaded and indexed file: {}", filename);
        
        Ok(file_info)
    }
    
    fn get_file_type(&self, filename: &str) -> String {
        if let Some(extension) = Path::new(filename).extension() {
            extension.to_string_lossy().to_lowercase()
        } else {
            "unknown".to_string()
        }
    }
    
    fn extract_text_content(&self, file_path: &Path, _file_type: &str) -> Result<String> {
        // Use the new extract module for real text extraction
        match crate::extract::extract_text_for_context(file_path) {
            Ok(formatted_content) => {
                // Extract just the content part (after "Content:\n")
                if let Some(content_start) = formatted_content.find("Content:\n") {
                    Ok(formatted_content[content_start + 9..].to_string())
                } else {
                    Ok(formatted_content)
                }
            }
            Err(e) => {
                Ok(format!("[Text extraction failed: {}]", e))
            }
        }
    }
    
    
    fn save_file_to_index(&self, file_info: &FileInfo) -> Result<()> {
        let mut files = self.list_files()?;
        files.push(file_info.clone());
        
        let json = serde_json::to_string_pretty(&files)?;
        fs::write(&self.index_path, json)?;
        
        Ok(())
    }
    
    pub fn list_files(&self) -> Result<Vec<FileInfo>> {
        if !self.index_path.exists() {
            return Ok(Vec::new());
        }
        
        let content = fs::read_to_string(&self.index_path)?;
        let files: Vec<FileInfo> = serde_json::from_str(&content)?;
        Ok(files)
    }
    
    pub fn delete_file(&self, file_id: &str) -> Result<()> {
        let mut files = self.list_files()?;
        files.retain(|f| f.id != file_id);
        
        let json = serde_json::to_string_pretty(&files)?;
        fs::write(&self.index_path, json)?;
        
        // Also delete the actual file
        let file_path = self.uploads_dir.join(file_id);
        if file_path.exists() {
            fs::remove_file(file_path)?;
        }
        
        Ok(())
    }
    
    pub fn toggle_file_context(&self, file_id: &str) -> Result<FileInfo> {
        let mut files = self.list_files()?;
        
        if let Some(file_index) = files.iter().position(|f| f.id == file_id) {
            files[file_index].is_context_enabled = !files[file_index].is_context_enabled;
            
            let json = serde_json::to_string_pretty(&files)?;
            fs::write(&self.index_path, json)?;
            
            Ok(files[file_index].clone())
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
    
    pub fn get_file_path(&self, file_info: &FileInfo) -> PathBuf {
        self.uploads_dir.join(format!("{}.{}", &file_info.id, &file_info.file_type))
    }
}
