// Test Ollama VLM directly
// Run: node test_ollama_vlm.js

const fs = require('fs');
const path = require('path');

async function testOllamaVLM() {
  console.log('🧪 Testing Ollama VLM caption generation...\n');

  // Find a recent screenshot to test with
  const workflowsDir = path.join(__dirname, 'src-tauri', 'workflows');
  const files = fs.readdirSync(workflowsDir)
    .filter(f => f.endsWith('.png') && fs.statSync(path.join(workflowsDir, f)).size > 0)
    .sort((a, b) => {
      const statA = fs.statSync(path.join(workflowsDir, a));
      const statB = fs.statSync(path.join(workflowsDir, b));
      return statB.mtime - statA.mtime;
    });

  if (files.length === 0) {
    console.error('❌ No screenshot files found in', workflowsDir);
    process.exit(1);
  }

  const testImagePath = path.join(workflowsDir, files[0]);
  console.log('📸 Using test image:', files[0]);
  console.log('   Path:', testImagePath);

  // Read and encode image
  const imageBuffer = fs.readFileSync(testImagePath);
  const base64Image = imageBuffer.toString('base64');
  console.log('   Size:', (imageBuffer.length / 1024 / 1024).toFixed(2), 'MB');
  console.log('   Base64 length:', base64Image.length, 'chars\n');

  // Test Ollama API
  const ollamaUrl = 'http://localhost:11434';
  console.log('🤖 Calling Ollama at', ollamaUrl);
  console.log('   Model: moondream:latest');

  const requestBody = {
    model: 'moondream:latest',
    prompt: 'Analyze this screenshot carefully. Describe exactly what you see: count people, describe their appearance and what they are doing, identify objects and their colors, describe the setting and lighting. Be specific and accurate.',
    images: [base64Image],
    stream: false,
    options: {
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      num_predict: 150,
    }
  };

  try {
    const startTime = Date.now();

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ollama API error:', response.status, errorText);
      process.exit(1);
    }

    const result = await response.json();

    console.log('\n✅ SUCCESS! VLM caption generated in', elapsed, 'ms');
    console.log('\n📝 Caption:');
    console.log('─'.repeat(80));
    console.log(result.response);
    console.log('─'.repeat(80));

    if (result.eval_count) {
      console.log('\n📊 Stats:');
      console.log('   Tokens:', result.eval_count);
      console.log('   Done:', result.done);
    }

    console.log('\n✅ Ollama VLM is working correctly!');

  } catch (error) {
    console.error('❌ FAILED:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure Ollama is running: ollama serve');
    console.error('2. Check Ollama models: curl http://localhost:11434/api/tags');
    console.error('3. Pull moondream if needed: ollama pull moondream');
    process.exit(1);
  }
}

testOllamaVLM();
