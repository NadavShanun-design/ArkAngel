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
pub fn check_agent_permissions() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        println!("[Agent] Checking macOS permissions...");

        // Check if Node.js/npx is available (required for UI-TARS)
        let npx_check = Command::new("npx").arg("--version").output();
        let node_available = npx_check.is_ok();

        let node_version = if node_available {
            if let Ok(output) = npx_check {
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            } else {
                "unknown".to_string()
            }
        } else {
            "not_installed".to_string()
        };

        // Return detailed permission information
        let permissions = serde_json::json!({
            "screenRecording": {
                "status": "manual_check_required",
                "required": true,
                "instruction": "1. Open System Settings\n2. Go to Privacy & Security → Screen Recording\n3. Enable ArkAngel in the list\n4. Restart the app if needed"
            },
            "accessibility": {
                "status": "manual_check_required",
                "required": true,
                "instruction": "1. Open System Settings\n2. Go to Privacy & Security → Accessibility\n3. Enable ArkAngel in the list\n4. Restart the app if needed"
            },
            "node": {
                "status": if node_available { "available" } else { "missing" },
                "version": node_version,
                "required": true,
                "instruction": if node_available {
                    format!("✅ Node.js is installed (npx version: {})", node_version)
                } else {
                    "❌ Install Node.js >= 22 from nodejs.org".to_string()
                }
            },
            "platform": "macOS",
            "note": "You must manually grant Screen Recording and Accessibility permissions in System Settings before the agent will work. The app will request these permissions when you start the agent."
        });

        println!("[Agent] Permission check complete. Node.js: {}", if node_available { "✓" } else { "✗" });

        Ok(permissions)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let permissions = serde_json::json!({
            "screenRecording": {"status": "not_required", "required": false},
            "accessibility": {"status": "not_required", "required": false},
            "node": {"status": "check_manually", "required": true, "instruction": "Ensure Node.js >= 22 is installed"},
            "platform": "non-macOS",
            "note": "UI-TARS permissions are primarily for macOS. Ensure Node.js is installed."
        });

        Ok(permissions)
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
