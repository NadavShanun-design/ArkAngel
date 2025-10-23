/**
 * Secure Storage - API Key Management via System Keychain
 *
 * This module provides secure storage for API keys using the system's
 * native credential storage:
 * - macOS: Keychain
 * - Windows: Credential Manager
 * - Linux: Secret Service API / kwallet
 *
 * Keys are encrypted at rest and never exposed in localStorage or plain text files.
 */

use keyring::Entry;
use serde::{Deserialize, Serialize};

/// Service name for keyring entries
const SERVICE_NAME: &str = "com.arkangel.apikeys";

/// Supported API key providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Provider {
    OpenAI,
    Anthropic,
    Gemini,
    Grok,
    Composio,
    GoogleOAuth,
    Custom(String),
}

impl Provider {
    /// Convert provider to keyring entry name
    fn to_key(&self) -> String {
        match self {
            Provider::OpenAI => "openai-api-key".to_string(),
            Provider::Anthropic => "anthropic-api-key".to_string(),
            Provider::Gemini => "gemini-api-key".to_string(),
            Provider::Grok => "grok-api-key".to_string(),
            Provider::Composio => "composio-api-key".to_string(),
            Provider::GoogleOAuth => "google-oauth-credentials".to_string(),
            Provider::Custom(name) => format!("custom-{}", name),
        }
    }

    /// Parse provider from string
    fn from_string(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "openai" => Provider::OpenAI,
            "anthropic" | "claude" => Provider::Anthropic,
            "gemini" | "google" => Provider::Gemini,
            "grok" => Provider::Grok,
            "composio" => Provider::Composio,
            "google-oauth" => Provider::GoogleOAuth,
            _ => Provider::Custom(s.to_string()),
        }
    }
}

/// Result type for storage operations
pub type StorageResult<T> = Result<T, String>;

/**
 * Store an API key securely in the system keychain
 *
 * @param provider - The provider name (e.g., "openai", "anthropic")
 * @param api_key - The API key to store
 * @returns Result indicating success or error message
 */
#[tauri::command]
pub fn store_api_key(provider: String, api_key: String) -> StorageResult<String> {
    let provider_enum = Provider::from_string(&provider);
    let key_name = provider_enum.to_key();

    println!("[SecureStorage] Storing API key for provider: {}", provider);

    // Create keyring entry
    let entry = Entry::new(SERVICE_NAME, &key_name)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    // Store the key
    entry
        .set_password(&api_key)
        .map_err(|e| format!("Failed to store API key: {}", e))?;

    println!("[SecureStorage] ✅ API key stored successfully for {}", provider);
    Ok(format!("API key for {} stored successfully", provider))
}

/**
 * Retrieve an API key from the system keychain
 *
 * @param provider - The provider name (e.g., "openai", "anthropic")
 * @returns The API key or error if not found
 */
#[tauri::command]
pub fn get_api_key(provider: String) -> StorageResult<String> {
    let provider_enum = Provider::from_string(&provider);
    let key_name = provider_enum.to_key();

    println!("[SecureStorage] Retrieving API key for provider: {}", provider);

    // Get keyring entry
    let entry = Entry::new(SERVICE_NAME, &key_name)
        .map_err(|e| format!("Failed to access keyring: {}", e))?;

    // Retrieve the key
    let api_key = entry
        .get_password()
        .map_err(|e| format!("API key not found for {}: {}", provider, e))?;

    println!("[SecureStorage] ✅ API key retrieved for {}", provider);
    Ok(api_key)
}

/**
 * Delete an API key from the system keychain
 *
 * @param provider - The provider name (e.g., "openai", "anthropic")
 * @returns Result indicating success or error message
 */
#[tauri::command]
pub fn delete_api_key(provider: String) -> StorageResult<String> {
    let provider_enum = Provider::from_string(&provider);
    let key_name = provider_enum.to_key();

    println!("[SecureStorage] Deleting API key for provider: {}", provider);

    // Get keyring entry
    let entry = Entry::new(SERVICE_NAME, &key_name)
        .map_err(|e| format!("Failed to access keyring: {}", e))?;

    // Delete the key
    entry
        .delete_credential()
        .map_err(|e| format!("Failed to delete API key: {}", e))?;

    println!("[SecureStorage] ✅ API key deleted for {}", provider);
    Ok(format!("API key for {} deleted successfully", provider))
}

/**
 * List all stored providers (without revealing the keys)
 *
 * @returns List of provider names that have stored keys
 */
#[tauri::command]
pub fn list_stored_providers() -> StorageResult<Vec<String>> {
    let providers = vec![
        "openai",
        "anthropic",
        "gemini",
        "grok",
        "composio",
        "google-oauth",
    ];

    let mut stored_providers = Vec::new();

    for provider in providers {
        let provider_enum = Provider::from_string(provider);
        let key_name = provider_enum.to_key();

        if let Ok(entry) = Entry::new(SERVICE_NAME, &key_name) {
            if entry.get_password().is_ok() {
                stored_providers.push(provider.to_string());
            }
        }
    }

    println!(
        "[SecureStorage] Found {} stored providers",
        stored_providers.len()
    );
    Ok(stored_providers)
}

/**
 * Check if a specific provider has a stored key
 *
 * @param provider - The provider name
 * @returns true if key exists, false otherwise
 */
#[tauri::command]
pub fn has_api_key(provider: String) -> bool {
    let provider_enum = Provider::from_string(&provider);
    let key_name = provider_enum.to_key();

    if let Ok(entry) = Entry::new(SERVICE_NAME, &key_name) {
        entry.get_password().is_ok()
    } else {
        false
    }
}

/**
 * Migrate API keys from localStorage to secure storage
 * This is called from the frontend with the localStorage data
 *
 * @param keys_json - JSON string with { provider: key } pairs
 * @returns Number of keys migrated
 */
#[tauri::command]
pub fn migrate_keys_to_secure_storage(keys_json: String) -> StorageResult<usize> {
    println!("[SecureStorage] Starting key migration...");

    // Parse JSON
    let keys: serde_json::Value = serde_json::from_str(&keys_json)
        .map_err(|e| format!("Failed to parse keys JSON: {}", e))?;

    let mut migrated_count = 0;

    // Migrate each key
    if let Some(keys_obj) = keys.as_object() {
        for (provider, key_value) in keys_obj {
            if let Some(key_str) = key_value.as_str() {
                if !key_str.is_empty() {
                    match store_api_key(provider.clone(), key_str.to_string()) {
                        Ok(_) => {
                            migrated_count += 1;
                            println!("[SecureStorage] ✅ Migrated {} key", provider);
                        }
                        Err(e) => {
                            eprintln!("[SecureStorage] ❌ Failed to migrate {}: {}", provider, e);
                        }
                    }
                }
            }
        }
    }

    println!(
        "[SecureStorage] ✅ Migration complete: {} keys migrated",
        migrated_count
    );
    Ok(migrated_count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_key_names() {
        assert_eq!(Provider::OpenAI.to_key(), "openai-api-key");
        assert_eq!(Provider::Anthropic.to_key(), "anthropic-api-key");
        assert_eq!(Provider::Composio.to_key(), "composio-api-key");
        assert_eq!(
            Provider::Custom("test".to_string()).to_key(),
            "custom-test"
        );
    }

    #[test]
    fn test_provider_from_string() {
        match Provider::from_string("openai") {
            Provider::OpenAI => (),
            _ => panic!("Expected OpenAI provider"),
        }

        match Provider::from_string("claude") {
            Provider::Anthropic => (),
            _ => panic!("Expected Anthropic provider"),
        }
    }
}
