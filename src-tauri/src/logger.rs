use serde::Serialize;
use tauri::Emitter;
use chrono::Utc;

/// Log event emitted to frontend for real-time monitoring
#[derive(Debug, Serialize, Clone)]
pub struct AppLogEvent {
    pub level: String,
    pub source: String,
    pub message: String,
    pub timestamp: String,
    pub details: Option<String>,
}

impl AppLogEvent {
    /// Create an info-level log event
    pub fn info(source: &str, message: String) -> Self {
        Self {
            level: "info".to_string(),
            source: source.to_string(),
            message,
            timestamp: Utc::now().to_rfc3339(),
            details: None,
        }
    }

    /// Create a success-level log event
    pub fn success(source: &str, message: String) -> Self {
        Self {
            level: "success".to_string(),
            source: source.to_string(),
            message,
            timestamp: Utc::now().to_rfc3339(),
            details: None,
        }
    }

    /// Create an error-level log event
    pub fn error(source: &str, message: String, details: Option<String>) -> Self {
        Self {
            level: "error".to_string(),
            source: source.to_string(),
            message,
            timestamp: Utc::now().to_rfc3339(),
            details,
        }
    }

    /// Create a debug-level log event
    pub fn debug(source: &str, message: String, details: Option<String>) -> Self {
        Self {
            level: "debug".to_string(),
            source: source.to_string(),
            message,
            timestamp: Utc::now().to_rfc3339(),
            details,
        }
    }

    /// Create a warning-level log event
    pub fn warn(source: &str, message: String, details: Option<String>) -> Self {
        Self {
            level: "warn".to_string(),
            source: source.to_string(),
            message,
            timestamp: Utc::now().to_rfc3339(),
            details,
        }
    }

    /// Emit this log event to the frontend and log to console
    pub fn emit_to_frontend(&self, app: &tauri::AppHandle) {
        // Log to console based on level
        let log_msg = if let Some(ref details) = self.details {
            format!("[{}] {}: {} ({})", self.source, self.message, details, self.timestamp)
        } else {
            format!("[{}] {}: {}", self.source, self.message, self.timestamp)
        };

        match self.level.as_str() {
            "error" => {
                tracing::error!("{}", log_msg);
                eprintln!("❌ {}", log_msg);
            }
            "warn" => {
                tracing::warn!("{}", log_msg);
                println!("⚠️  {}", log_msg);
            }
            "success" => {
                tracing::info!("{}", log_msg);
                println!("✅ {}", log_msg);
            }
            "debug" => {
                tracing::debug!("{}", log_msg);
                println!("🔍 {}", log_msg);
            }
            _ => {
                tracing::info!("{}", log_msg);
                println!("ℹ️  {}", log_msg);
            }
        }

        // Emit to frontend (best-effort, don't panic if it fails)
        if let Err(e) = app.emit("app_log", self.clone()) {
            eprintln!("Failed to emit log event to frontend: {}", e);
        }
    }
}

/// Initialize the logging system with file output and console output
pub fn init_logging() -> anyhow::Result<()> {
    use tracing_subscriber::{fmt, EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};
    use tracing_appender::rolling::{RollingFileAppender, Rotation};
    use std::fs;

    // Create logs directory if it doesn't exist
    let log_dir = std::env::current_dir()?.join("logs");
    fs::create_dir_all(&log_dir)?;

    // Get log path string before moving log_dir
    let log_path = log_dir.display().to_string();

    // Create rolling file appender (daily rotation)
    let file_appender = RollingFileAppender::new(
        Rotation::DAILY,
        log_dir,
        "arkangel.log"
    );

    // Build the subscriber with both console and file output
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("arkangel=debug,info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt::layer().with_writer(file_appender))
        .with(fmt::layer().with_writer(std::io::stdout))
        .init();

    tracing::info!("🚀 Logging system initialized - logs will be written to {}", log_path);
    println!("🚀 Logging system initialized - logs will be written to {}", log_path);

    Ok(())
}

/// Helper macro for emitting logs with automatic source detection
#[macro_export]
macro_rules! emit_log {
    ($app:expr, info, $msg:expr) => {
        $crate::logger::AppLogEvent::info(module_path!(), $msg.to_string()).emit_to_frontend($app)
    };
    ($app:expr, success, $msg:expr) => {
        $crate::logger::AppLogEvent::success(module_path!(), $msg.to_string()).emit_to_frontend($app)
    };
    ($app:expr, error, $msg:expr) => {
        $crate::logger::AppLogEvent::error(module_path!(), $msg.to_string(), None).emit_to_frontend($app)
    };
    ($app:expr, error, $msg:expr, $details:expr) => {
        $crate::logger::AppLogEvent::error(module_path!(), $msg.to_string(), Some($details.to_string())).emit_to_frontend($app)
    };
    ($app:expr, debug, $msg:expr) => {
        $crate::logger::AppLogEvent::debug(module_path!(), $msg.to_string(), None).emit_to_frontend($app)
    };
    ($app:expr, warn, $msg:expr) => {
        $crate::logger::AppLogEvent::warn(module_path!(), $msg.to_string(), None).emit_to_frontend($app)
    };
}
