use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub provider: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    pub model: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
}

pub struct AgentState {
    process: Mutex<Option<Child>>,
}

impl AgentState {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
        }
    }

    pub fn is_running(&self) -> bool {
        if let Ok(mut process_lock) = self.process.lock() {
            if let Some(ref mut child) = *process_lock {
                // Check if process is still alive
                match child.try_wait() {
                    Ok(Some(_)) => {
                        // Process has exited
                        *process_lock = None;
                        false
                    }
                    Ok(None) => true, // Still running
                    Err(_) => {
                        *process_lock = None;
                        false
                    }
                }
            } else {
                false
            }
        } else {
            false
        }
    }

    pub fn stop(&self) -> Result<(), String> {
        if let Ok(mut process_lock) = self.process.lock() {
            if let Some(mut child) = process_lock.take() {
                println!("[Agent] Stopping agent process (PID: {:?})", child.id());
                child
                    .kill()
                    .map_err(|e| format!("Failed to kill agent process: {}", e))?;
                println!("[Agent] Agent process stopped");
            }
        }
        Ok(())
    }

    pub fn start(&self, config: &AgentConfig) -> Result<String, String> {
        // Stop any existing process first
        self.stop()?;

        println!(
            "[Agent] Starting agent with provider: {}, model: {}",
            config.provider, config.model
        );

        // Spawn the agent process using npx @ui-tars/cli
        // This assumes the user has Node.js installed and UI-TARS CLI available
        let mut child = Command::new("npx")
            .args([
                "@ui-tars/cli@latest",
                "start",
                "--provider",
                &config.provider,
                "--model",
                &config.model,
                "--apiKey",
                &config.api_key,
                "--baseUrl",
                &config.base_url,
                "--headless", // Run in headless mode
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn agent process: {}. Make sure Node.js and npx are installed.", e))?;

        let pid = child.id();
        println!("[Agent] Agent process started with PID: {}", pid);

        if let Ok(mut process_lock) = self.process.lock() {
            *process_lock = Some(child);
        }

        Ok(format!("Agent started successfully (PID: {})", pid))
    }
}

#[tauri::command]
pub fn check_agent_permissions() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        // On macOS, we need to check for Screen Recording and Accessibility permissions
        // This is a simplified check - in a real implementation, you'd use macOS APIs
        // For now, we'll return true and let the user handle permissions manually
        println!("[Agent] Checking macOS permissions (Screen Recording & Accessibility)");

        // You can implement actual permission checks using macOS APIs here
        // For example, using CGPreflightScreenCaptureAccess() for Screen Recording

        Ok(true) // Assume permissions are granted for now
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On other platforms, permissions are usually not required
        Ok(true)
    }
}

#[tauri::command]
pub fn start_agent(
    state: State<AgentState>,
    provider: String,
    api_key: String,
    model: String,
    base_url: String,
) -> Result<String, String> {
    let config = AgentConfig {
        provider,
        api_key,
        model,
        base_url,
    };

    state.start(&config)
}

#[tauri::command]
pub fn stop_agent(state: State<AgentState>) -> Result<String, String> {
    state.stop()?;
    Ok("Agent stopped successfully".to_string())
}

#[tauri::command]
pub fn test_agent(
    provider: String,
    api_key: String,
    model: String,
    base_url: String,
) -> Result<String, String> {
    println!(
        "[Agent] Testing agent configuration: provider={}, model={}, baseUrl={}",
        provider, model, base_url
    );

    // Simple validation checks
    if api_key.trim().is_empty() {
        return Err("API key is required".to_string());
    }

    if model.trim().is_empty() {
        return Err("Model name is required".to_string());
    }

    if base_url.trim().is_empty() {
        return Err("Base URL is required".to_string());
    }

    // Validate base URL format
    if !base_url.starts_with("http://") && !base_url.starts_with("https://") {
        return Err("Base URL must start with http:// or https://".to_string());
    }

    // Check if npx is available
    let npx_check = Command::new("npx")
        .arg("--version")
        .output();

    if npx_check.is_err() {
        return Err("npx (Node Package eXecute) is not installed or not in PATH. Please install Node.js (>= 22) to use the agent.".to_string());
    }

    println!("[Agent] Configuration test passed successfully");
    Ok(format!(
        "✓ Configuration valid\n✓ Provider: {}\n✓ Model: {}\n✓ Base URL: {}\n✓ npx available",
        provider, model, base_url
    ))
}

#[tauri::command]
pub fn get_agent_status(state: State<AgentState>) -> Result<bool, String> {
    Ok(state.is_running())
}
