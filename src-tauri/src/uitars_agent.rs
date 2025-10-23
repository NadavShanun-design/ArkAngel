use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};
use std::io::{BufRead, BufReader, Write};
use std::sync::{Arc, Mutex};
use std::sync::mpsc::{channel, Sender};
use std::thread;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UITarsConfig {
    pub provider: String,
    pub api_key: String,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteCommandRequest {
    pub instruction: String,
    pub config: UITarsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteCommandResponse {
    pub success: bool,
    pub message: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversations: Option<Vec<Conversation>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub screenshot: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub role: String,
    pub content: String,
}

pub struct UITarsAgent {
    process: Arc<Mutex<Option<Child>>>,
    command_sender: Arc<Mutex<Option<Sender<String>>>>,
}

impl UITarsAgent {
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
            command_sender: Arc::new(Mutex::new(None)),
        }
    }

    pub fn spawn(&self, app_handle: tauri::AppHandle) -> Result<(), String> {
        println!("[UITars] 🚀 spawn() called");
        let mut process_guard = self.process.lock().unwrap();

        if process_guard.is_some() {
            eprintln!("[UITars] ❌ Agent already running");
            return Err("Agent already running".to_string());
        }

        // Try multiple possible paths for the service
        println!("[UITars] 📂 Getting current directory...");
        let current_dir = std::env::current_dir()
            .map_err(|e| {
                eprintln!("[UITars] ❌ Failed to get current directory: {}", e);
                format!("Failed to get current directory: {}", e)
            })?;

        println!("[UITars] ✓ Current directory: {:?}", current_dir);

        let possible_paths = vec![
            current_dir.join("src-tauri").join("uitars-service"),
            current_dir.join("uitars-service"),
        ];

        println!("[UITars] 🔍 Searching for service in {} locations...", possible_paths.len());
        for path in &possible_paths {
            let dist_path = path.join("dist").join("index.js");
            println!("[UITars]   Checking: {:?}", dist_path);
            println!("[UITars]   Exists: {}", dist_path.exists());
        }

        let service_path = possible_paths
            .into_iter()
            .find(|p| p.join("dist").join("index.js").exists())
            .ok_or_else(|| {
                eprintln!("[UITars] ❌ UI-TARS service not found in any location");
                "UI-TARS service not found. Please ensure uitars-service is built (npm run build)".to_string()
            })?;

        println!("[UITars] ✓ Found service at: {:?}", service_path);
        println!("[UITars] 🎯 Starting Node.js service...");

        let mut child = Command::new("node")
            .arg("dist/index.js")
            .current_dir(&service_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                eprintln!("[UITars] ❌ Failed to spawn Node.js process: {}", e);
                eprintln!("[UITars]    Error type: {:?}", e.kind());
                eprintln!("[UITars]    Service path: {:?}", service_path);
                format!("Failed to spawn UI-TARS service: {} (check that Node.js is installed)", e)
            })?;

        println!("[UITars] ✓ Node.js process spawned successfully (PID: {:?})", child.id());

        // Take ownership of stdin for command sending
        println!("[UITars] 📥 Setting up stdin for command sending...");
        let mut stdin = child.stdin.take()
            .ok_or_else(|| {
                eprintln!("[UITars] ❌ Failed to get stdin from child process");
                "Failed to get stdin".to_string()
            })?;

        // Take ownership of stdout for reading responses
        println!("[UITars] 📤 Setting up stdout for reading responses...");
        let stdout = child.stdout.take()
            .ok_or_else(|| {
                eprintln!("[UITars] ❌ Failed to get stdout from child process");
                "Failed to get stdout".to_string()
            })?;

        // Take ownership of stderr for error logging
        println!("[UITars] 🔴 Setting up stderr for error logging...");
        let stderr = child.stderr.take()
            .ok_or_else(|| {
                eprintln!("[UITars] ❌ Failed to get stderr from child process");
                "Failed to get stderr".to_string()
            })?;

        // Create channel for sending commands to the stdin thread
        let (tx, rx) = channel::<String>();

        println!("[UITars] 🧵 Spawning stdin writer thread...");
        // Spawn thread to handle stdin writes
        thread::spawn(move || {
            println!("[UITars] ✓ Stdin thread started");
            while let Ok(command) = rx.recv() {
                println!("[UITars] 📝 Writing command to service stdin");
                if let Err(e) = writeln!(stdin, "{}", command) {
                    eprintln!("[UITars] ❌ Failed to write to stdin: {}", e);
                    break;
                }
                if let Err(e) = stdin.flush() {
                    eprintln!("[UITars] ❌ Failed to flush stdin: {}", e);
                    break;
                }
            }
            println!("[UITars] ⏹️ Stdin thread ended");
        });

        println!("[UITars] 🧵 Spawning stdout reader thread...");
        // Spawn thread to handle stdout reads
        let reader = BufReader::new(stdout);
        let app_handle_clone = app_handle.clone();
        thread::spawn(move || {
            println!("[UITars] ✓ Stdout thread started");
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        println!("[UITars] 📨 Received from service: {}", &line[..line.len().min(150)]);
                        if let Ok(response) = serde_json::from_str::<ExecuteCommandResponse>(&line) {
                            println!("[UITars] ✓ Parsed response: status={}, success={}",
                                response.status,
                                response.success
                            );

                            let _ = app_handle_clone.emit("uitars-update", response);
                        } else {
                            println!("[UITars] ⚠️ Non-JSON line from service (possibly console.log)");
                        }
                    }
                    Err(e) => {
                        eprintln!("[UITars] ❌ Error reading stdout: {}", e);

                        // Emit error to frontend
                        let error_response = ExecuteCommandResponse {
                            success: false,
                            message: format!("Service error: {}", e),
                            status: "error".to_string(),
                            conversations: None,
                            screenshot: None,
                            action: None,
                            error: Some(format!("{}", e)),
                        };
                        let _ = app_handle_clone.emit("uitars-update", error_response);
                        break;
                    }
                }
            }
            println!("[UITars] ⏹️ Stdout thread ended");
        });

        println!("[UITars] 🧵 Spawning stderr reader thread...");
        // Spawn thread to handle stderr reads (error logging)
        let stderr_reader = BufReader::new(stderr);
        thread::spawn(move || {
            println!("[UITars] ✓ Stderr thread started");
            for line in stderr_reader.lines() {
                match line {
                    Ok(line) => {
                        eprintln!("[UITars] 🔴 Service stderr: {}", line);

                        // Emit stderr logs to frontend for debugging
                        let error_response = ExecuteCommandResponse {
                            success: false,
                            message: format!("🔧 Debug: {}", line),
                            status: "running".to_string(),
                            conversations: None,
                            screenshot: None,
                            action: None,
                            error: None,
                        };
                        let _ = app_handle.emit("uitars-debug", error_response);
                    }
                    Err(e) => {
                        eprintln!("[UITars] ❌ Error reading stderr: {}", e);
                        break;
                    }
                }
            }
            println!("[UITars] ⏹️ Stderr thread ended");
        });

        println!("[UITars] 💾 Storing process handles...");
        *self.command_sender.lock().unwrap() = Some(tx);
        *process_guard = Some(child);
        println!("[UITars] ✅ Agent spawned successfully!");
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut process_guard = self.process.lock().unwrap();

        if let Some(mut child) = process_guard.take() {
            println!("[UITars] Stopping service...");
            child.kill().map_err(|e| format!("Failed to kill process: {}", e))?;
            child.wait().map_err(|e| format!("Failed to wait for process: {}", e))?;
            println!("[UITars] Service stopped");
        }

        *self.command_sender.lock().unwrap() = None;
        Ok(())
    }

    pub fn send_command(
        &self,
        request: ExecuteCommandRequest,
    ) -> Result<(), String> {
        let sender_guard = self.command_sender.lock().unwrap();

        let sender = sender_guard
            .as_ref()
            .ok_or("Agent not running")?;

        // Serialize request
        let request_json = serde_json::to_string(&request)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;

        println!("[UITars] Sending command: {}", request.instruction);

        // Send command via channel
        sender.send(request_json)
            .map_err(|e| format!("Failed to send command: {}", e))?;

        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.process.lock().unwrap().is_some()
    }
}

#[tauri::command]
pub async fn start_uitars_agent(
    state: tauri::State<'_, Arc<Mutex<UITarsAgent>>>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let agent = state.lock().unwrap();
    agent.spawn(app_handle)?;
    Ok("UI-TARS agent started successfully".to_string())
}

#[tauri::command]
pub async fn stop_uitars_agent(
    state: tauri::State<'_, Arc<Mutex<UITarsAgent>>>,
) -> Result<String, String> {
    let agent = state.lock().unwrap();
    agent.stop()?;
    Ok("UI-TARS agent stopped successfully".to_string())
}

#[tauri::command]
pub async fn execute_uitars_command(
    instruction: String,
    provider: String,
    api_key: String,
    model: String,
    base_url: Option<String>,
    state: tauri::State<'_, Arc<Mutex<UITarsAgent>>>,
) -> Result<String, String> {
    let agent = state.lock().unwrap();

    let config = UITarsConfig {
        provider,
        api_key,
        model,
        base_url,
    };

    let request = ExecuteCommandRequest {
        instruction,
        config,
    };

    agent.send_command(request)?;
    Ok("Command sent to UI-TARS agent".to_string())
}

#[tauri::command]
pub async fn is_uitars_running(
    state: tauri::State<'_, Arc<Mutex<UITarsAgent>>>,
) -> Result<bool, String> {
    let agent = state.lock().unwrap();
    Ok(agent.is_running())
}
