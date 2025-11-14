// ============================================================================
// Supabase Client Module
// ============================================================================
//
// This module handles all interactions with Supabase for the multi-tenant
// employer/employee screenshot monitoring system.
//
// Features:
// - Screenshot metadata upload to Supabase database
// - Organization and user management
// - Real-time sync integration
//

use anyhow::{Context, Result};
use postgrest::Postgrest;
use serde::{Deserialize, Serialize};
use std::env;

// ============================================================================
// Configuration
// ============================================================================

#[derive(Clone)]
pub struct SupabaseClient {
    rest_client: Postgrest,
    pub url: String,
    pub anon_key: String,
}

impl SupabaseClient {
    /// Initialize Supabase client from environment variables
    pub fn new() -> Result<Self> {
        let url = env::var("VITE_SUPABASE_URL")
            .context("VITE_SUPABASE_URL not set in environment")?;
        let anon_key = env::var("VITE_SUPABASE_ANON_KEY")
            .context("VITE_SUPABASE_ANON_KEY not set in environment")?;

        let rest_url = format!("{}/rest/v1", url);
        let rest_client = Postgrest::new(rest_url)
            .insert_header("apikey", &anon_key)
            .insert_header("Authorization", format!("Bearer {}", anon_key));

        Ok(Self {
            rest_client,
            url,
            anon_key,
        })
    }

    /// Initialize with custom credentials (for testing or multiple projects)
    pub fn with_credentials(url: String, anon_key: String) -> Self {
        let rest_url = format!("{}/rest/v1", url);
        let rest_client = Postgrest::new(rest_url)
            .insert_header("apikey", &anon_key)
            .insert_header("Authorization", format!("Bearer {}", anon_key));

        Self {
            rest_client,
            url,
            anon_key,
        }
    }
}

// ============================================================================
// Data Structures
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScreenshotInsert {
    pub user_id: String,
    pub organization_id: String,
    pub screenshot_id: String,
    pub file_path: String,
    pub timestamp: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub file_size: Option<i64>,
    pub caption: Option<String>,
    pub detected_category: Option<String>,
    pub storage_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Screenshot {
    pub id: String,
    pub user_id: String,
    pub organization_id: String,
    pub screenshot_id: String,
    pub file_path: String,
    pub timestamp: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub file_size: Option<i64>,
    pub caption: Option<String>,
    pub caption_generated_at: Option<String>,
    pub detected_category: Option<String>,
    pub storage_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmployeeAnalytics {
    pub id: String,
    pub user_id: String,
    pub organization_id: String,
    pub total_screenshots: i32,
    pub category_breakdown: serde_json::Value,
    pub timeline: serde_json::Value,
    pub most_used_category: Option<String>,
    pub last_updated: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Organization {
    pub id: String,
    pub employer_id: String,
    pub name: String,
    pub employer_code: String,
    pub created_at: String,
}

// ============================================================================
// Screenshot Operations
// ============================================================================

impl SupabaseClient {
    /// Insert screenshot metadata using the database function
    pub async fn insert_screenshot(&self, screenshot: ScreenshotInsert) -> Result<String> {
        let response = self
            .rest_client
            .rpc(
                "insert_screenshot",
                serde_json::json!({
                    "p_user_id": screenshot.user_id,
                    "p_organization_id": screenshot.organization_id,
                    "p_screenshot_id": screenshot.screenshot_id,
                    "p_file_path": screenshot.file_path,
                    "p_timestamp": screenshot.timestamp,
                    "p_width": screenshot.width,
                    "p_height": screenshot.height,
                    "p_file_size": screenshot.file_size,
                    "p_caption": screenshot.caption,
                    "p_detected_category": screenshot.detected_category,
                    "p_storage_url": screenshot.storage_url,
                })
                .to_string(),
            )
            .execute()
            .await
            .context("Failed to insert screenshot")?;

        let body = response
            .text()
            .await
            .context("Failed to read response body")?;

        // Response should be a UUID
        let uuid: String = serde_json::from_str(&body)
            .context("Failed to parse screenshot UUID from response")?;

        Ok(uuid)
    }

    /// Get all screenshots for a user
    pub async fn get_user_screenshots(&self, user_id: &str) -> Result<Vec<Screenshot>> {
        let response = self
            .rest_client
            .from("screenshots")
            .select("*")
            .eq("user_id", user_id)
            .order("timestamp.desc")
            .execute()
            .await
            .context("Failed to fetch screenshots")?;

        let body = response
            .text()
            .await
            .context("Failed to read response body")?;

        let screenshots: Vec<Screenshot> = serde_json::from_str(&body)
            .context("Failed to parse screenshots from response")?;

        Ok(screenshots)
    }

    /// Update screenshot category (e.g., after AI categorization)
    pub async fn update_screenshot_category(
        &self,
        screenshot_id: &str,
        category: &str,
    ) -> Result<()> {
        self.rest_client
            .from("screenshots")
            .update(serde_json::json!({ "detected_category": category }).to_string())
            .eq("screenshot_id", screenshot_id)
            .execute()
            .await
            .context("Failed to update screenshot category")?;

        Ok(())
    }
}

// ============================================================================
// Analytics Operations
// ============================================================================

impl SupabaseClient {
    /// Get employee analytics for a user
    pub async fn get_employee_analytics(&self, user_id: &str) -> Result<Option<EmployeeAnalytics>> {
        let response = self
            .rest_client
            .from("employee_analytics")
            .select("*")
            .eq("user_id", user_id)
            .single()
            .execute()
            .await
            .context("Failed to fetch employee analytics")?;

        let body = response
            .text()
            .await
            .context("Failed to read response body")?;

        if body.is_empty() || body == "null" {
            return Ok(None);
        }

        let analytics: EmployeeAnalytics = serde_json::from_str(&body)
            .context("Failed to parse employee analytics from response")?;

        Ok(Some(analytics))
    }

    /// Manually trigger analytics update for a user
    pub async fn update_employee_analytics(&self, user_id: &str) -> Result<()> {
        self.rest_client
            .rpc(
                "update_employee_analytics",
                serde_json::json!({
                    "target_user_id": user_id
                })
                .to_string(),
            )
            .execute()
            .await
            .context("Failed to update employee analytics")?;

        Ok(())
    }
}

// ============================================================================
// Organization Operations
// ============================================================================

impl SupabaseClient {
    /// Get organization by employer code
    pub async fn get_organization_by_code(&self, employer_code: &str) -> Result<Option<Organization>> {
        let response = self
            .rest_client
            .from("organizations")
            .select("*")
            .eq("employer_code", employer_code)
            .single()
            .execute()
            .await
            .context("Failed to fetch organization")?;

        let body = response
            .text()
            .await
            .context("Failed to read response body")?;

        if body.is_empty() || body == "null" {
            return Ok(None);
        }

        let org: Organization = serde_json::from_str(&body)
            .context("Failed to parse organization from response")?;

        Ok(Some(org))
    }

    /// Get organization by ID
    pub async fn get_organization(&self, org_id: &str) -> Result<Option<Organization>> {
        let response = self
            .rest_client
            .from("organizations")
            .select("*")
            .eq("id", org_id)
            .single()
            .execute()
            .await
            .context("Failed to fetch organization")?;

        let body = response
            .text()
            .await
            .context("Failed to read response body")?;

        if body.is_empty() || body == "null" {
            return Ok(None);
        }

        let org: Organization = serde_json::from_str(&body)
            .context("Failed to parse organization from response")?;

        Ok(Some(org))
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Get Supabase Storage URL for a screenshot
pub fn get_storage_url(supabase_url: &str, user_id: &str, filename: &str) -> String {
    format!(
        "{}/storage/v1/object/public/screenshots/{}/{}",
        supabase_url, user_id, filename
    )
}

/// Build screenshot metadata from local workflow data
pub fn build_screenshot_insert(
    user_id: String,
    organization_id: String,
    screenshot_id: String,
    file_path: String,
    timestamp: String,
    caption: Option<String>,
    detected_category: Option<String>,
) -> ScreenshotInsert {
    ScreenshotInsert {
        user_id,
        organization_id,
        screenshot_id,
        file_path,
        timestamp,
        width: None,
        height: None,
        file_size: None,
        caption,
        detected_category,
        storage_url: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_url_generation() {
        let url = get_storage_url(
            "https://example.supabase.co",
            "user-123",
            "screenshot.png",
        );
        assert_eq!(
            url,
            "https://example.supabase.co/storage/v1/object/public/screenshots/user-123/screenshot.png"
        );
    }

    #[test]
    fn test_screenshot_insert_builder() {
        let insert = build_screenshot_insert(
            "user-123".to_string(),
            "org-456".to_string(),
            "screenshot-789".to_string(),
            "/path/to/screenshot.png".to_string(),
            "2025-11-12T10:30:00Z".to_string(),
            Some("User browsing code editor".to_string()),
            Some("code_editors".to_string()),
        );

        assert_eq!(insert.user_id, "user-123");
        assert_eq!(insert.organization_id, "org-456");
        assert_eq!(insert.screenshot_id, "screenshot-789");
        assert_eq!(insert.detected_category, Some("code_editors".to_string()));
    }
}
