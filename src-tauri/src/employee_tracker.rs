use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use chrono::Utc;
use reqwest;
use crate::supabase_client::{SupabaseClient, build_screenshot_insert};

const EMPLOYEES_DIR: &str = "./employees";
const CATEGORIES_FILE: &str = "./software_categories.json";
const JOHN_DOE_ID: &str = "john_doe";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SoftwareCategory {
    pub keywords: Vec<String>,
    pub icon: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SoftwareInstance {
    pub screenshot_id: String,
    pub timestamp: String,
    // AI-based detection (new format)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detected_category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption_preview: Option<String>,
    // Keyword-based detection (old format - kept for backwards compatibility)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detected_keywords: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CategoryUsage {
    pub count: usize,
    pub percentage: f64,
    pub instances: Vec<SoftwareInstance>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimelineEntry {
    pub date: String,
    pub screenshots: usize,
    pub most_used: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmployeeUsageData {
    pub employee_id: String,
    pub last_updated: String,
    pub total_screenshots: usize,
    pub software_usage: HashMap<String, CategoryUsage>,
    pub timeline: Vec<TimelineEntry>,
}

/// Load software categories from JSON file
fn load_categories() -> Result<HashMap<String, SoftwareCategory>, String> {
    let content = fs::read_to_string(CATEGORIES_FILE)
        .map_err(|e| format!("Failed to read categories file: {}", e))?;

    let categories: HashMap<String, SoftwareCategory> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse categories: {}", e))?;

    Ok(categories)
}

/// Load John Doe's current usage data
fn load_john_doe_data() -> Result<EmployeeUsageData, String> {
    let file_path = Path::new(EMPLOYEES_DIR).join(format!("{}_usage.json", JOHN_DOE_ID));

    if !file_path.exists() {
        // Create initial empty data
        let categories = load_categories()?;
        let mut software_usage = HashMap::new();

        for category_name in categories.keys() {
            software_usage.insert(category_name.clone(), CategoryUsage {
                count: 0,
                percentage: 0.0,
                instances: Vec::new(),
            });
        }

        return Ok(EmployeeUsageData {
            employee_id: JOHN_DOE_ID.to_string(),
            last_updated: Utc::now().to_rfc3339(),
            total_screenshots: 0,
            software_usage,
            timeline: Vec::new(),
        });
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read John Doe data: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse John Doe data: {}", e))
}

/// Save John Doe's usage data
fn save_john_doe_data(data: &EmployeeUsageData) -> Result<(), String> {
    // Ensure employees directory exists
    fs::create_dir_all(EMPLOYEES_DIR)
        .map_err(|e| format!("Failed to create employees directory: {}", e))?;

    let file_path = Path::new(EMPLOYEES_DIR).join(format!("{}_usage.json", JOHN_DOE_ID));

    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize data: {}", e))?;

    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write data: {}", e))?;

    println!("[EmployeeTracker] Updated John Doe data: {} total screenshots", data.total_screenshots);
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaOptions {
    temperature: f32,
    num_predict: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaResponse {
    response: String,
}

/// Use Phi-3-mini AI to categorize software from VLM caption
async fn categorize_with_ai(caption: &str, categories: &HashMap<String, SoftwareCategory>) -> Result<String, String> {
    let category_list: Vec<String> = categories.keys().cloned().collect();
    let category_str = category_list.join(", ");

    let prompt = format!(
        "You are a software usage analyzer. Read this screenshot description and determine which software category it belongs to.

Screenshot description: \"{}\"

Available categories: {}

Rules:
1. Choose ONLY ONE category from the list above
2. If multiple categories apply, choose the most specific one
3. If no category matches well, choose \"other\"
4. Respond with ONLY the category name, nothing else

Category:",
        caption, category_str
    );

    let request = OllamaRequest {
        model: "phi3:mini".to_string(),
        prompt,
        stream: false,
        options: OllamaOptions {
            temperature: 0.1,
            num_predict: 50,
        },
    };

    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:11434/api/generate")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to call Ollama API: {}", e))?;

    let ollama_response: OllamaResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    // Clean up the response - remove any non-alphanumeric characters except underscores
    let category = ollama_response.response
        .trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_')
        .collect::<String>();

    // Validate that the category exists
    if categories.contains_key(&category) {
        Ok(category)
    } else {
        // If AI returned invalid category, default to "other"
        println!("[EmployeeTracker] AI returned invalid category '{}', defaulting to 'other'", category);
        Ok("other".to_string())
    }
}

/// Sync screenshot to Supabase (if user is authenticated and has organization)
async fn sync_to_supabase(
    user_id: &str,
    organization_id: &str,
    screenshot_id: &str,
    timestamp: &str,
    caption: &str,
    detected_category: &str,
) -> Result<(), String> {
    // Only attempt to sync if environment variables are set
    let supabase_url = std::env::var("VITE_SUPABASE_URL");
    if supabase_url.is_err() {
        println!("[EmployeeTracker] Supabase URL not configured, skipping sync");
        return Ok(());
    }

    println!("[EmployeeTracker] Syncing screenshot to Supabase...");

    match SupabaseClient::new() {
        Ok(client) => {
            let screenshot = build_screenshot_insert(
                user_id.to_string(),
                organization_id.to_string(),
                screenshot_id.to_string(),
                format!("screenshots/{}/{}.png", user_id, screenshot_id),
                timestamp.to_string(),
                Some(caption.to_string()),
                Some(detected_category.to_string()),
            );

            match client.insert_screenshot(screenshot).await {
                Ok(uuid) => {
                    println!("[EmployeeTracker] Successfully synced to Supabase with ID: {}", uuid);
                    Ok(())
                }
                Err(e) => {
                    eprintln!("[EmployeeTracker] Failed to sync to Supabase: {}", e);
                    // Don't fail the whole operation if Supabase sync fails
                    Ok(())
                }
            }
        }
        Err(e) => {
            eprintln!("[EmployeeTracker] Supabase client initialization failed: {}", e);
            // Don't fail the whole operation if Supabase is not configured
            Ok(())
        }
    }
}

/// Update John Doe's employee data with a new screenshot
pub async fn update_john_doe_with_screenshot(
    screenshot_id: &str,
    timestamp: &str,
    caption: &str,
) -> Result<(), String> {
    println!("[EmployeeTracker] Processing screenshot {} for John Doe", screenshot_id);
    println!("[EmployeeTracker] Caption: {}", &caption[..caption.len().min(100)]);

    // Load categories and current data
    let categories = load_categories()?;
    let mut data = load_john_doe_data()?;

    // Use AI to categorize the screenshot
    let detected_category = match categorize_with_ai(caption, &categories).await {
        Ok(category) => {
            println!("[EmployeeTracker] AI detected category: {}", category);
            category
        }
        Err(e) => {
            println!("[EmployeeTracker] AI categorization failed: {}, defaulting to 'other'", e);
            "other".to_string()
        }
    };

    // Add to detected category
    if let Some(category) = data.software_usage.get_mut(&detected_category) {
        category.instances.push(SoftwareInstance {
            screenshot_id: screenshot_id.to_string(),
            timestamp: timestamp.to_string(),
            detected_category: Some(detected_category.clone()),
            caption_preview: Some(caption[..caption.len().min(100)].to_string()),
            detected_keywords: None,
            confidence: None,
        });
        category.count += 1;
    }

    // Update total count
    data.total_screenshots += 1;

    // Recalculate percentages
    for category in data.software_usage.values_mut() {
        category.percentage = if data.total_screenshots > 0 {
            (category.count as f64 / data.total_screenshots as f64) * 100.0
        } else {
            0.0
        };
    }

    // Update timeline
    let today = Utc::now().format("%Y-%m-%d").to_string();
    if let Some(entry) = data.timeline.iter_mut().find(|e| e.date == today) {
        entry.screenshots += 1;
    } else {
        data.timeline.push(TimelineEntry {
            date: today,
            screenshots: 1,
            most_used: String::new(), // Will be calculated next
        });
    }

    // Find most used category
    let most_used = data.software_usage.iter()
        .filter(|(_, usage)| usage.count > 0)
        .max_by_key(|(_, usage)| usage.count)
        .map(|(name, _)| name.clone())
        .unwrap_or_else(|| "other".to_string());

    if let Some(entry) = data.timeline.last_mut() {
        entry.most_used = most_used;
    }

    // Update timestamp
    data.last_updated = Utc::now().to_rfc3339();

    // Save updated data locally
    save_john_doe_data(&data)?;

    // Sync to Supabase (non-blocking, will skip if not configured or no user context)
    // Get user context from global state (set by frontend when user logs in)
    if let Some(user_ctx) = crate::user_context::get_user_context() {
        if let Some(org_id) = user_ctx.organization_id {
            let _ = sync_to_supabase(
                &user_ctx.user_id,
                &org_id,
                screenshot_id,
                timestamp,
                caption,
                &detected_category,
            ).await;
        } else {
            println!("[EmployeeTracker] User has no organization_id, skipping Supabase sync");
        }
    } else {
        println!("[EmployeeTracker] No user context available, skipping Supabase sync");
    }

    println!("[EmployeeTracker] Successfully updated John Doe data");
    Ok(())
}
