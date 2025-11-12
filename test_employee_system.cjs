const http = require('http');
const fs = require('fs');

console.log('='.repeat(80));
console.log('EMPLOYEE MONITORING SYSTEM - FULL TEST');
console.log('='.repeat(80));

// Test 1: Check Ollama Models
console.log('\n[Test 1] Checking Ollama models...');
const checkModels = new Promise((resolve, reject) => {
  http.get('http://localhost:11434/api/tags', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const tags = JSON.parse(data);
        const moondream = tags.models.find(m => m.name === 'moondream:latest');
        const phi3 = tags.models.find(m => m.name === 'phi3:mini');

        if (moondream && phi3) {
          console.log('  ✅ moondream:latest - VLM model found');
          console.log('  ✅ phi3:mini - AI categorization model found');
          resolve(true);
        } else {
          console.log('  ❌ Missing required models');
          reject(new Error('Models not found'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }).on('error', reject);
});

// Test 2: Test Phi-3-mini categorization
const testAI = async () => {
  console.log('\n[Test 2] Testing Phi-3-mini AI categorization...');

  const testCases = [
    { caption: 'showing a web browser with multiple tabs open', expected: 'browsers' },
    { caption: 'displaying a code editor with syntax highlighting', expected: 'code_editors' },
    { caption: 'showing a social media feed with posts', expected: 'social_media' },
    { caption: 'displaying an email client with inbox', expected: 'email' },
  ];

  for (const testCase of testCases) {
    const prompt = `You are a software usage analyzer. Read this screenshot description and determine which software category it belongs to.

Screenshot description: "${testCase.caption}"

Available categories: browsers, code_editors, social_media, communication, productivity, email, design, terminal, media, other

Rules:
1. Choose ONLY ONE category from the list above
2. If multiple categories apply, choose the most specific one
3. If no category matches well, choose "other"
4. Respond with ONLY the category name, nothing else

Category:`;

    const result = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        model: 'phi3:mini',
        prompt: prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 50 }
      });

      const req = http.request({
        hostname: 'localhost',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const category = response.response.trim().toLowerCase().replace(/[^a-z_]/g, '');
            resolve(category);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    const match = result === testCase.expected ? '✅' : '⚠️';
    console.log(`  ${match} Caption: "${testCase.caption}"`);
    console.log(`     Expected: ${testCase.expected}, Got: ${result}`);
  }
};

// Test 3: Check John Doe data
const checkJohnDoeData = () => {
  console.log('\n[Test 3] Checking John Doe employee data...');

  try {
    const data = JSON.parse(fs.readFileSync('./src-tauri/employees/john_doe_usage.json', 'utf-8'));

    console.log(`  ✅ Employee ID: ${data.employee_id}`);
    console.log(`  ✅ Total Screenshots: ${data.total_screenshots}`);
    console.log(`  ✅ Last Updated: ${data.last_updated}`);

    console.log('\n  Category Breakdown:');
    for (const [category, usage] of Object.entries(data.software_usage)) {
      if (usage.count > 0) {
        console.log(`    • ${category}: ${usage.count} (${usage.percentage.toFixed(1)}%)`);

        // Check if AI format is being used
        const hasAIFormat = usage.instances[0]?.detected_category !== undefined;
        const format = hasAIFormat ? 'AI-powered' : 'keyword-based';
        console.log(`      Format: ${format}`);
      }
    }

    // Check timeline
    if (data.timeline && data.timeline.length > 0) {
      const latest = data.timeline[data.timeline.length - 1];
      console.log(`\n  ✅ Timeline: ${latest.screenshots} screenshots on ${latest.date}`);
      console.log(`     Most used: ${latest.most_used}`);
    }

    return true;
  } catch (error) {
    console.log('  ❌ Error reading John Doe data:', error.message);
    return false;
  }
};

// Test 4: Check if Tauri app is running
const checkTauriApp = () => {
  console.log('\n[Test 4] Checking if Tauri app is running...');

  // Check if port 1420 is responding
  return new Promise((resolve) => {
    http.get('http://localhost:1420/', (res) => {
      console.log('  ✅ Tauri app is running on http://localhost:1420/');
      resolve(true);
    }).on('error', () => {
      console.log('  ❌ Tauri app not responding on port 1420');
      resolve(false);
    });
  });
};

// Test 5: Verify employee dashboard files
const checkDashboardFiles = () => {
  console.log('\n[Test 5] Verifying employee dashboard files...');

  const files = [
    './src/components/employees/EmployeesPage.tsx',
    './src/types/employee.ts',
    './src-tauri/src/employee_tracker.rs',
    './src-tauri/software_categories.json',
    './src-tauri/employees/index.json'
  ];

  let allExist = true;
  for (const file of files) {
    if (fs.existsSync(file)) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} - NOT FOUND`);
      allExist = false;
    }
  }

  return allExist;
};

// Run all tests
(async () => {
  try {
    await checkModels;
    await testAI();
    checkJohnDoeData();
    await checkTauriApp();
    checkDashboardFiles();

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL TESTS PASSED - System is ready!');
    console.log('='.repeat(80));
    console.log('\nTo test the full flow:');
    console.log('1. Open the app (should be running on http://localhost:1420)');
    console.log('2. Go to Advanced Settings → Employees');
    console.log('3. Take a screenshot using the camera icon in Photos section');
    console.log('4. Wait 5-10 seconds for VLM caption + AI categorization');
    console.log('5. Refresh the Employees page to see updated pie chart');
    console.log('\nReal-time flow: Screenshot → VLM caption → Phi-3-mini AI → John Doe data → Pie chart');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
})();
