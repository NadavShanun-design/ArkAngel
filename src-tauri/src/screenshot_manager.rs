use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use uuid::Uuid;
use chrono::Utc;
use image::{DynamicImage, ImageFormat};

// Constants
const WORKFLOWS_DIR: &str = "./workflows";
const MAX_WIDTH: u32 = 1920; // Maximum screenshot width before resizing
const IMAGE_QUALITY: u8 = 90; // PNG quality

/// Screenshot metadata stored in index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotInfo {
    pub id: String,
    pub file_path: String,
    pub timestamp: String,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
    pub added_to_training: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub training_added_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,              // VLM-generated caption
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption_generated_at: Option<String>, // When caption was created
}

/// Screenshot index wrapper
#[derive(Debug, Serialize, Deserialize)]
struct ScreenshotIndex {
    screenshots: Vec<ScreenshotInfo>,
}

impl ScreenshotIndex {
    fn new() -> Self {
        Self {
            screenshots: Vec::new(),
        }
    }

    fn load() -> Result<Self, String> {
        let index_path = Path::new(WORKFLOWS_DIR).join("index.json");

        if !index_path.exists() {
            return Ok(Self::new());
        }

        let contents = fs::read_to_string(&index_path)
            .map_err(|e| format!("Failed to read index: {}", e))?;

        serde_json::from_str(&contents)
            .map_err(|e| format!("Failed to parse index: {}", e))
    }

    fn save(&self) -> Result<(), String> {
        let index_path = Path::new(WORKFLOWS_DIR).join("index.json");

        // Ensure workflows directory exists
        fs::create_dir_all(WORKFLOWS_DIR)
            .map_err(|e| format!("Failed to create workflows directory: {}", e))?;

        // Write to temp file first for atomic operation
        let temp_path = index_path.with_extension("json.tmp");
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize index: {}", e))?;

        fs::write(&temp_path, json)
            .map_err(|e| format!("Failed to write temp index: {}", e))?;

        // Atomic rename
        fs::rename(&temp_path, &index_path)
            .map_err(|e| format!("Failed to rename index: {}", e))?;

        Ok(())
    }
}

/// Capture screenshot from primary monitor
pub fn capture_primary_monitor() -> Result<ScreenshotInfo, String> {
    println!("[Screenshot] Starting capture...");

    // Get all monitors
    let monitors = xcap::Monitor::all()
        .map_err(|e| format!("Failed to get monitors: {}", e))?;

    if monitors.is_empty() {
        return Err("No monitors found".to_string());
    }

    // Use first monitor (primary)
    let monitor = &monitors[0];
    println!("[Screenshot] Capturing from monitor: {:?}", monitor.name());

    // Capture image
    let image_buffer = monitor.capture_image()
        .map_err(|e| format!("Failed to capture image: {}", e))?;

    println!("[Screenshot] Captured {}x{} image", image_buffer.width(), image_buffer.height());

    // Convert to DynamicImage
    let image = DynamicImage::ImageRgba8(image_buffer);

    // Process and save
    let screenshot_info = process_and_save_screenshot(image)?;

    // Add to index
    add_to_index(&screenshot_info)?;

    println!("[Screenshot] Saved to: {}", screenshot_info.file_path);
    Ok(screenshot_info)
}

/// Process image (resize if needed) and save to disk
fn process_and_save_screenshot(image: DynamicImage) -> Result<ScreenshotInfo, String> {
    // Generate UUID for filename
    let id = Uuid::new_v4().to_string();

    // Resize if too large
    let processed_image = if image.width() > MAX_WIDTH {
        println!("[Screenshot] Resizing from {} to {} width", image.width(), MAX_WIDTH);
        let aspect_ratio = image.height() as f32 / image.width() as f32;
        let new_height = (MAX_WIDTH as f32 * aspect_ratio) as u32;
        image.resize(MAX_WIDTH, new_height, image::imageops::FilterType::Lanczos3)
    } else {
        image
    };

    let width = processed_image.width();
    let height = processed_image.height();

    // Create workflows directory if it doesn't exist
    fs::create_dir_all(WORKFLOWS_DIR)
        .map_err(|e| format!("Failed to create workflows directory: {}", e))?;

    // Save image
    let filename = format!("screenshot_{}.png", id);
    let file_path = Path::new(WORKFLOWS_DIR).join(&filename);

    processed_image.save_with_format(&file_path, ImageFormat::Png)
        .map_err(|e| format!("Failed to save image: {}", e))?;

    // Get file size
    let metadata = fs::metadata(&file_path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    let file_size = metadata.len();

    Ok(ScreenshotInfo {
        id,
        file_path: file_path.to_string_lossy().to_string(),
        timestamp: Utc::now().to_rfc3339(),
        width,
        height,
        file_size,
        added_to_training: false,
        training_added_at: None,
        caption: None,
        caption_generated_at: None,
    })
}

/// Add screenshot to index
fn add_to_index(screenshot: &ScreenshotInfo) -> Result<(), String> {
    let mut index = ScreenshotIndex::load()?;

    // Add new screenshot at beginning (newest first)
    index.screenshots.insert(0, screenshot.clone());

    index.save()?;
    Ok(())
}

/// Get all screenshots from index
pub fn get_all_screenshots() -> Result<Vec<ScreenshotInfo>, String> {
    let index = ScreenshotIndex::load()?;

    // Validate that files still exist and have non-zero size
    let valid_screenshots: Vec<ScreenshotInfo> = index.screenshots
        .into_iter()
        .filter(|s| {
            let path = Path::new(&s.file_path);
            path.exists() && path.metadata().map(|m| m.len() > 0).unwrap_or(false)
        })
        .collect();

    Ok(valid_screenshots)
}

/// Mark screenshot as added to training
pub fn mark_as_added_to_training(screenshot_id: &str) -> Result<(), String> {
    let mut index = ScreenshotIndex::load()?;

    // Find and update the screenshot
    if let Some(screenshot) = index.screenshots.iter_mut().find(|s| s.id == screenshot_id) {
        screenshot.added_to_training = true;
        screenshot.training_added_at = Some(Utc::now().to_rfc3339());
    } else {
        return Err(format!("Screenshot not found: {}", screenshot_id));
    }

    index.save()?;
    Ok(())
}

/// Delete screenshot from disk and index
pub fn delete_screenshot(screenshot_id: &str) -> Result<(), String> {
    let mut index = ScreenshotIndex::load()?;

    // Find the screenshot
    let screenshot = index.screenshots.iter()
        .find(|s| s.id == screenshot_id)
        .ok_or_else(|| format!("Screenshot not found: {}", screenshot_id))?;

    // Delete file if it exists
    let file_path = Path::new(&screenshot.file_path);
    if file_path.exists() {
        fs::remove_file(file_path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    // Remove from index
    index.screenshots.retain(|s| s.id != screenshot_id);

    index.save()?;
    Ok(())
}

/// Get screenshot by ID
pub fn get_screenshot_by_id(screenshot_id: &str) -> Result<ScreenshotInfo, String> {
    let index = ScreenshotIndex::load()?;

    index.screenshots.into_iter()
        .find(|s| s.id == screenshot_id)
        .ok_or_else(|| format!("Screenshot not found: {}", screenshot_id))
}

/// Add caption to existing screenshot (async, can fail gracefully)
pub async fn add_caption_to_screenshot(screenshot_id: &str, ollama_url: Option<&str>) -> Result<ScreenshotInfo, String> {
    println!("[Screenshot] Generating caption for screenshot: {}", screenshot_id);

    // Get screenshot info
    let screenshot_info = get_screenshot_by_id(screenshot_id)?;

    // Generate caption with local Ollama VLM
    let caption = generate_caption_for_screenshot(&screenshot_info, ollama_url).await?;

    println!("[Screenshot] Caption generated: {}", &caption[..caption.len().min(50)]);

    // Update index with caption
    update_screenshot_caption(screenshot_id, &caption)?;

    // Return updated info
    let mut updated_info = screenshot_info;
    updated_info.caption = Some(caption);
    updated_info.caption_generated_at = Some(Utc::now().to_rfc3339());

    Ok(updated_info)
}

/// Generate caption for screenshot using local Ollama VLM
async fn generate_caption_for_screenshot(
    screenshot: &ScreenshotInfo,
    ollama_url: Option<&str>,
) -> Result<String, String> {
    use crate::vlm_captioner;

    // Call local Ollama VLM (Moondream by default)
    let result = vlm_captioner::caption_with_ollama(
        &screenshot.file_path,
        ollama_url,
        None  // Use default model (moondream:latest)
    ).await?;

    Ok(result.caption)
}

/// Update screenshot caption in index
pub fn update_screenshot_caption(screenshot_id: &str, caption: &str) -> Result<(), String> {
    let mut index = ScreenshotIndex::load()?;

    if let Some(screenshot) = index.screenshots.iter_mut().find(|s| s.id == screenshot_id) {
        screenshot.caption = Some(caption.to_string());
        screenshot.caption_generated_at = Some(Utc::now().to_rfc3339());
    } else {
        return Err(format!("Screenshot not found: {}", screenshot_id));
    }

    index.save()?;
    Ok(())
}
