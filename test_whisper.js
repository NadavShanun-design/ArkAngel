// Test script to check Whisper API functionality
console.log("Testing Whisper API configuration...");

// Check if we're in a browser environment
if (typeof window !== 'undefined') {
  console.log("Running in browser environment");
  
  // Check localStorage for API keys - use correct storage key
  const settings = localStorage.getItem('settings');
  if (settings) {
    const parsed = JSON.parse(settings);
    console.log("Settings found:", {
      selectedProvider: parsed.selectedProvider,
      hasApiKey: !!parsed.apiKey,
      hasOpenAiApiKey: !!parsed.openAiApiKey,
      isApiKeySubmitted: parsed.isApiKeySubmitted,
      isOpenAiApiKeySubmitted: parsed.isOpenAiApiKeySubmitted
    });
  } else {
    console.log("No settings found in localStorage");
  }
  
  // Test the transcribeAudio function if available
  if (window.transcribeAudio) {
    console.log("transcribeAudio function is available");
  } else {
    console.log("transcribeAudio function is NOT available");
  }
  
  // Check for any global errors
  window.addEventListener('error', (e) => {
    console.error("Global error:", e.error);
  });
  
} else {
  console.log("Not in browser environment");
}

// Test microphone access
if (navigator && navigator.mediaDevices) {
  console.log("Media devices available");
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      console.log("Microphone access granted");
      stream.getTracks().forEach(track => track.stop());
    })
    .catch(err => {
      console.error("Microphone access denied:", err);
    });
} else {
  console.log("Media devices not available");
}

console.log("Whisper API test completed");
