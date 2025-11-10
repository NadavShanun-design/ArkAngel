import { invoke } from "@tauri-apps/api/core";

/**
 * Transcribe audio using on-device Whisper (pre-built binary)
 * This is MUCH faster than OpenAI API and fully private
 */
export const transcribeAudioLocal = async (
  audioData: Float32Array
): Promise<string> => {
  try {
    console.log("🎙️ [Local] Starting on-device transcription...");
    console.log("🎙️ [Local] Audio samples:", audioData.length);

    // Convert Float32Array to regular array for Tauri
    const audioArray = Array.from(audioData);

    // Call Rust backend
    const transcription = await invoke<string>("transcribe_audio_local", {
      audioData: audioArray,
    });

    console.log("✅ [Local] Transcription complete:", transcription);
    return transcription.trim();
  } catch (error) {
    console.error("❌ [Local] Transcription error:", error);
    throw error;
  }
};

/**
 * Check if local transcription is available
 */
export const isLocalTranscriptionAvailable = async (): Promise<boolean> => {
  try {
    const available = await invoke<boolean>("is_local_transcription_available");
    console.log("🔍 [Local] Transcription available:", available);
    return available;
  } catch (error) {
    console.error("❌ [Local] Failed to check availability:", error);
    return false;
  }
};

/**
 * Get paths to whisper binary and model (for debugging)
 */
export const getWhisperPaths = async (): Promise<[string, string]> => {
  try {
    const paths = await invoke<[string, string]>("get_whisper_paths");
    console.log("🔍 [Local] Binary path:", paths[0]);
    console.log("🔍 [Local] Model path:", paths[1]);
    return paths;
  } catch (error) {
    console.error("❌ [Local] Failed to get paths:", error);
    return ["", ""];
  }
};
