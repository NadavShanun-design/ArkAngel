use anyhow::{Context, Result};
use hound::{WavSpec, WavWriter};
use std::path::PathBuf;
use std::sync::Mutex;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::logger::AppLogEvent;

/// Manages Whisper model loading and transcription
pub struct TranscriptionManager {
    context: Mutex<Option<WhisperContext>>,
    model_path: PathBuf,
}

impl TranscriptionManager {
    /// Create a new transcription manager
    pub fn new() -> Self {
        // Default model path in the app's models directory
        let model_path = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("arkangel")
            .join("models")
            .join("ggml-base.en.bin");

        Self {
            context: Mutex::new(None),
            model_path,
        }
    }

    /// Initialize the Whisper model (lazy loading)
    fn ensure_model_loaded(&self, app_handle: &tauri::AppHandle) -> Result<()> {
        let mut context_guard = self.context.lock().unwrap();

        if context_guard.is_none() {
            AppLogEvent::info("Transcription", "Loading Whisper model...".to_string())
                .emit_to_frontend(app_handle);

            // Check if model exists
            if !self.model_path.exists() {
                let error_msg = format!(
                    "Whisper model not found at: {}\nPlease download the model first.",
                    self.model_path.display()
                );
                AppLogEvent::error("Transcription", error_msg.clone(), None)
                    .emit_to_frontend(app_handle);
                return Err(anyhow::anyhow!(error_msg));
            }

            // Load the model
            let ctx_params = WhisperContextParameters::default();
            let ctx = WhisperContext::new_with_params(&self.model_path.to_string_lossy(), ctx_params)
                .context("Failed to load Whisper model")?;

            AppLogEvent::success("Transcription", "Whisper model loaded successfully".to_string())
                .emit_to_frontend(app_handle);

            *context_guard = Some(ctx);
        }

        Ok(())
    }

    /// Transcribe audio data (Float32Array from frontend)
    pub fn transcribe(
        &self,
        audio_data: Vec<f32>,
        app_handle: &tauri::AppHandle,
    ) -> Result<String> {
        AppLogEvent::info(
            "Transcription",
            format!("Starting transcription of {} samples", audio_data.len()),
        )
        .emit_to_frontend(app_handle);

        // Ensure model is loaded
        self.ensure_model_loaded(app_handle)?;

        // Get the context
        let context_guard = self.context.lock().unwrap();
        let ctx = context_guard
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Whisper context not initialized"))?;

        // Convert audio to 16kHz if needed (whisper expects 16kHz)
        // Assuming input is already at correct sample rate from VAD
        let audio_16khz = audio_data;

        // Create state for this transcription
        let mut state = ctx.create_state().context("Failed to create whisper state")?;

        // Set up transcription parameters
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

        // Configure params for best quality
        params.set_n_threads(4);
        params.set_language(Some("en")); // English only for now
        params.set_translate(false);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);

        AppLogEvent::info("Transcription", "Running Whisper inference...".to_string())
            .emit_to_frontend(app_handle);

        // Run transcription
        state
            .full(params, &audio_16khz[..])
            .context("Failed to run whisper transcription")?;

        // Extract transcription text
        let num_segments = state
            .full_n_segments()
            .context("Failed to get segment count")?;

        let mut transcription = String::new();
        for i in 0..num_segments {
            let segment = state
                .full_get_segment_text(i)
                .context("Failed to get segment text")?;
            transcription.push_str(&segment);
            transcription.push(' ');
        }

        let final_text = transcription.trim().to_string();

        AppLogEvent::success(
            "Transcription",
            format!("Transcription complete: \"{}\"", final_text),
        )
        .emit_to_frontend(app_handle);

        Ok(final_text)
    }

    /// Get the expected model path for display to users
    pub fn get_model_path(&self) -> String {
        self.model_path.display().to_string()
    }

    /// Check if model exists
    pub fn is_model_available(&self) -> bool {
        self.model_path.exists()
    }
}

/// Convert audio samples to WAV file (helper function)
pub fn samples_to_wav_bytes(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>> {
    let spec = WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut cursor = std::io::Cursor::new(Vec::new());
    {
        let mut writer = WavWriter::new(&mut cursor, spec)?;
        for sample in samples {
            let amplitude = (sample * i16::MAX as f32) as i16;
            writer.write_sample(amplitude)?;
        }
        writer.finalize()?;
    }

    Ok(cursor.into_inner())
}
