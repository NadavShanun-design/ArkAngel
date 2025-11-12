const fs = require('fs');
const http = require('http');

// Ollama API endpoint
const OLLAMA_URL = 'http://localhost:11434';
const MODEL = 'phi3:mini';

// Load data
const indexPath = './src-tauri/workflows/index.json';
const categoriesPath = './src-tauri/software_categories.json';
const outputPath = './src-tauri/employees/john_doe_usage.json';

console.log('[AI Rebuild] Loading screenshot index...');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));

console.log('[AI Rebuild] Found', index.screenshots.length, 'total screenshots');

// Filter screenshots with captions
const screenshotsWithCaptions = index.screenshots.filter(s => s.caption && s.caption.trim().length > 0);
console.log('[AI Rebuild] Found', screenshotsWithCaptions.length, 'screenshots with captions');

// Initialize usage data structure
function initializeUsageData() {
    const usage = {};
    for (const categoryName of Object.keys(categories)) {
        usage[categoryName] = {
            count: 0,
            percentage: 0.0,
            instances: []
        };
    }
    return usage;
}

// Call Phi-3-mini to categorize software from VLM caption
async function categorizeSoftwareWithAI(caption) {
    const categoryList = Object.keys(categories).join(', ');

    const prompt = `You are a software usage analyzer. Read this screenshot description and determine which software category it belongs to.

Screenshot description: "${caption}"

Available categories: ${categoryList}

Rules:
1. Choose ONLY ONE category from the list above
2. If multiple categories apply, choose the most specific one
3. If no category matches well, choose "other"
4. Respond with ONLY the category name, nothing else

Category:`;

    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: MODEL,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.1,  // Low temperature for consistent results
                num_predict: 50     // Short response expected
            }
        });

        const options = {
            hostname: 'localhost',
            port: 11434,
            path: '/api/generate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

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

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

// Process all screenshots
async function processAllScreenshots() {
    const usage = initializeUsageData();
    let processedCount = 0;

    console.log('\n[AI Rebuild] Starting AI analysis with Phi-3-mini...\n');

    for (const screenshot of screenshotsWithCaptions) {
        processedCount++;
        console.log(`[${processedCount}/${screenshotsWithCaptions.length}] Processing screenshot: ${screenshot.id}`);
        console.log(`  Caption: ${screenshot.caption.substring(0, 100)}...`);

        try {
            // Use Phi-3-mini to categorize
            const detectedCategory = await categorizeSoftwareWithAI(screenshot.caption);

            console.log(`  AI Decision: ${detectedCategory}`);

            // Validate category exists
            if (!usage[detectedCategory]) {
                console.log(`  Warning: Unknown category "${detectedCategory}", using "other"`);
                detectedCategory = 'other';
            }

            // Add to usage data
            usage[detectedCategory].instances.push({
                screenshot_id: screenshot.id,
                timestamp: screenshot.timestamp,
                detected_category: detectedCategory,
                caption_preview: screenshot.caption.substring(0, 100)
            });
            usage[detectedCategory].count++;

            console.log(`  ✓ Added to ${detectedCategory} (now ${usage[detectedCategory].count} total)\n`);

        } catch (error) {
            console.error(`  ✗ Error processing screenshot ${screenshot.id}:`, error.message);
            // Add to "other" category if AI fails
            usage.other.instances.push({
                screenshot_id: screenshot.id,
                timestamp: screenshot.timestamp,
                detected_category: 'other',
                caption_preview: screenshot.caption.substring(0, 100),
                error: error.message
            });
            usage.other.count++;
        }

        // Small delay to not overwhelm Ollama
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate percentages
    const total = screenshotsWithCaptions.length;
    for (const category of Object.keys(usage)) {
        usage[category].percentage = total > 0 ? (usage[category].count / total) * 100.0 : 0.0;
    }

    // Find most used category
    const mostUsed = Object.entries(usage)
        .filter(([_, data]) => data.count > 0)
        .sort(([_, a], [__, b]) => b.count - a.count)[0];

    // Build final data structure
    const johnDoeData = {
        employee_id: 'john_doe',
        last_updated: new Date().toISOString(),
        total_screenshots: total,
        software_usage: usage,
        timeline: [
            {
                date: new Date().toISOString().split('T')[0],
                screenshots: total,
                most_used: mostUsed ? mostUsed[0] : 'other'
            }
        ]
    };

    // Save to file
    fs.writeFileSync(outputPath, JSON.stringify(johnDoeData, null, 2));
    console.log('\n[AI Rebuild] ✓ Successfully saved John Doe data to:', outputPath);
    console.log('\n[AI Rebuild] Summary:');
    console.log('  Total screenshots analyzed:', total);
    console.log('  Categories detected:');
    for (const [category, data] of Object.entries(usage)) {
        if (data.count > 0) {
            console.log(`    - ${category}: ${data.count} (${data.percentage.toFixed(1)}%)`);
        }
    }
    console.log('\n[AI Rebuild] COMPLETE!');
}

// Run the rebuild
processAllScreenshots().catch(error => {
    console.error('[AI Rebuild] Fatal error:', error);
    process.exit(1);
});
