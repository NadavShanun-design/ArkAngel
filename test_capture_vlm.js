// Test screenshot capture with VLM caption
// Run this in the browser console when the app is running

async function testScreenshotCapture() {
  console.log('🧪 Testing screenshot capture with VLM...');

  try {
    // Import Tauri API
    const { invoke } = window.__TAURI__.core;

    console.log('📸 Attempting to capture screenshot with caption...');
    const ollamaUrl = 'http://localhost:11434';

    try {
      // Try with VLM caption
      const result = await invoke('capture_screenshot_with_caption', { ollamaUrl });

      console.log('✅ SUCCESS! Screenshot captured with VLM caption:');
      console.log('   ID:', result.id);
      console.log('   Path:', result.file_path);
      console.log('   Size:', result.width, 'x', result.height);
      console.log('   File size:', (result.file_size / 1024 / 1024).toFixed(2), 'MB');
      console.log('   Caption:', result.caption ? result.caption.substring(0, 100) + '...' : 'No caption');
      console.log('   Caption generated at:', result.caption_generated_at);

      alert(`✅ Screenshot captured successfully!\n\n` +
            `ID: ${result.id}\n` +
            `Size: ${result.width}x${result.height}\n` +
            `Caption preview: ${result.caption ? result.caption.substring(0, 150) + '...' : 'No caption'}`);

      return result;

    } catch (captionError) {
      console.log('⚠️ VLM caption failed, trying without caption...');
      console.error('Caption error:', captionError);

      // Fallback: capture without caption
      const result = await invoke('capture_screenshot');

      console.log('✅ SUCCESS! Screenshot captured (no caption):');
      console.log('   ID:', result.id);
      console.log('   Path:', result.file_path);
      console.log('   Size:', result.width, 'x', result.height);

      alert(`✅ Screenshot captured (no caption)!\n\n` +
            `ID: ${result.id}\n` +
            `Size: ${result.width}x${result.height}\n` +
            `Note: VLM caption generation failed`);

      return result;
    }

  } catch (error) {
    console.error('❌ FAILED:', error);
    alert(`❌ Screenshot capture failed!\n\n${error}\n\n` +
          `Make sure:\n` +
          `1. Screen Recording permission is granted\n` +
          `2. App is running in dev mode\n` +
          `3. Ollama is running (for VLM captions)`);
    throw error;
  }
}

// Run the test
testScreenshotCapture();
