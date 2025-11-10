use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::io::Write;
use tempfile::NamedTempFile;

use crate::logger::AppLogEvent;

/// Local whisper.cpp transcription using pre-built binary
pub struct WhisperLocal {
    binary_path: PathBuf,
    model_path: PathBuf,
}

impl WhisperLocal {
    /// Create a new WhisperLocal instance
    pub fn new(binary_path: PathBuf, model_path: PathBuf) -> Result<Self> {
        // Verify binary exists and is executable
        if !binary_path.exists() {
            return Err(anyhow::anyhow!(
                "Whisper binary not found at: {}",
                binary_path.display()
            ));
        }

        // Verify model exists
        if !model_path.exists() {
            return Err(anyhow::anyhow!(
                "Whisper model not found at: {}",
                model_path.display()
            ));
        }

        Ok(Self {
            binary_path,
            model_path,
        })
    }

    /// Transcribe audio data (Float32Array from frontend)
    ///
    /// Steps:
    /// 1. Convert Float32Array to WAV file
    /// 2. Save to temp file
    /// 3. Call whisper binary
    /// 4. Parse output
    /// 5. Return transcription
    pub fn transcribe(
        &self,
        audio_data: Vec<f32>,
        app_handle: &tauri::AppHandle,
    ) -> Result<String> {
        AppLogEvent::info(
            "WhisperLocal",
            format!("Starting local transcription of {} samples", audio_data.len()),
        )
        .emit_to_frontend(app_handle);

        // Step 1: Convert to WAV and save to temp file
        let wav_file = self.create_temp_wav(&audio_data)?;

        AppLogEvent::info(
            "WhisperLocal",
            format!("Created temp WAV file: {}", wav_file.path().display()),
        )
        .emit_to_frontend(app_handle);

        // Step 2: Call whisper binary
        let transcription = self.call_whisper_binary(wav_file.path(), app_handle)?;

        AppLogEvent::success(
            "WhisperLocal",
            format!("Transcription complete: \"{}\"", transcription),
        )
        .emit_to_frontend(app_handle);

        Ok(transcription)
    }

    /// Create a temporary WAV file from Float32Array
    fn create_temp_wav(&self, audio_data: &[f32]) -> Result<NamedTempFile> {
        let mut temp_file = NamedTempFile::new()
            .context("Failed to create temp file")?;

        // WAV file format specification
        let sample_rate: u32 = 16000; // 16kHz required by whisper
        let num_channels: u16 = 1; // Mono
        let bits_per_sample: u16 = 16;

        let num_samples = audio_data.len() as u32;
        let byte_rate = sample_rate * u32::from(num_channels) * u32::from(bits_per_sample) / 8;
        let block_align = num_channels * bits_per_sample / 8;
        let data_size = num_samples * u32::from(block_align);

        // Write WAV header
        temp_file.write_all(b"RIFF")?;
        temp_file.write_all(&(36 + data_size).to_le_bytes())?;
        temp_file.write_all(b"WAVE")?;
        temp_file.write_all(b"fmt ")?;
        temp_file.write_all(&16u32.to_le_bytes())?; // fmt chunk size
        temp_file.write_all(&1u16.to_le_bytes())?; // audio format (1 = PCM)
        temp_file.write_all(&num_channels.to_le_bytes())?;
        temp_file.write_all(&sample_rate.to_le_bytes())?;
        temp_file.write_all(&byte_rate.to_le_bytes())?;
        temp_file.write_all(&block_align.to_le_bytes())?;
        temp_file.write_all(&bits_per_sample.to_le_bytes())?;
        temp_file.write_all(b"data")?;
        temp_file.write_all(&data_size.to_le_bytes())?;

        // Write audio data (convert f32 to i16)
        for sample in audio_data {
            let sample_i16 = (sample.clamp(-1.0, 1.0) * 32767.0) as i16;
            temp_file.write_all(&sample_i16.to_le_bytes())?;
        }

        temp_file.flush()?;
        Ok(temp_file)
    }

    /// Call the whisper binary and parse output
    fn call_whisper_binary(
        &self,
        audio_path: &Path,
        app_handle: &tauri::AppHandle,
    ) -> Result<String> {
        AppLogEvent::info(
            "WhisperLocal",
            format!("Calling whisper binary: {}", self.binary_path.display()),
        )
        .emit_to_frontend(app_handle);

        // Build command
        let output = Command::new(&self.binary_path)
            .arg("-m")
            .arg(&self.model_path)
            .arg("-f")
            .arg(audio_path)
            .arg("-t")
            .arg("4") // 4 threads
            .arg("-l")
            .arg("en") // English
            .arg("--no-timestamps") // Don't include timestamps in output
            .arg("-nt") // No timestamps
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .context("Failed to execute whisper binary")?;

        // Check if command succeeded
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            AppLogEvent::error(
                "WhisperLocal",
                "Whisper binary failed".to_string(),
                Some(stderr.to_string()),
            )
            .emit_to_frontend(app_handle);

            return Err(anyhow::anyhow!("Whisper binary failed: {}", stderr));
        }

        // Parse stdout
        let stdout = String::from_utf8_lossy(&output.stdout);
        let transcription = self.parse_whisper_output(&stdout);

        Ok(transcription)
    }

    /// Parse whisper output to extract transcription text
    ///
    /// Whisper output format:
    /// [00:00:00.000 --> 00:00:03.000]  This is the transcribed text
    fn parse_whisper_output(&self, output: &str) -> String {
        let mut transcription = String::new();

        for line in output.lines() {
            // Skip empty lines
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Skip progress/info lines
            if line.contains("whisper_") || line.contains("ggml_") || line.contains("system_info") {
                continue;
            }

            // Extract text after timestamp
            if line.contains("-->") {
                // Format: [00:00:00.000 --> 00:00:03.000]  Text here
                if let Some(text_start) = line.find(']') {
                    let text = line[text_start + 1..].trim();
                    if !text.is_empty() {
                        transcription.push_str(text);
                        transcription.push(' ');
                    }
                }
            } else {
                // Some outputs don't have timestamps, just add the line
                if !line.starts_with('[') {
                    transcription.push_str(line);
                    transcription.push(' ');
                }
            }
        }

        transcription.trim().to_string()
    }

    /// Check if binary and model are available
    pub fn is_available(&self) -> bool {
        self.binary_path.exists() && self.model_path.exists()
    }

    /// Get paths for debugging
    pub fn get_paths(&self) -> (String, String) {
        (
            self.binary_path.display().to_string(),
            self.model_path.display().to_string(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_whisper_output() {
        let whisper = WhisperLocal {
            binary_path: PathBuf::from("/dummy"),
            model_path: PathBuf::from("/dummy"),
        };

        let output = r#"
[00:00:00.000 --> 00:00:03.000]  This is a test
[00:00:03.000 --> 00:00:05.000]  of the transcription system
        "#;

        let result = whisper.parse_whisper_output(output);
        assert_eq!(result, "This is a test of the transcription system");
    }
}
