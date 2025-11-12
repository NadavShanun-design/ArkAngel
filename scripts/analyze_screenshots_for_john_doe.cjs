const fs = require('fs');
const path = require('path');

// Load screenshots with captions
const indexPath = path.join(__dirname, '../src-tauri/workflows/index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

// Load software categories
const categoriesPath = path.join(__dirname, '../src-tauri/software_categories.json');
const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));

console.log('📸 Analyzing screenshots for John Doe...\n');

// Analyze each screenshot caption
const usage = {};
let totalScreenshots = 0;

// Initialize categories
Object.keys(categories).forEach(category => {
  usage[category] = {
    count: 0,
    percentage: 0,
    instances: []
  };
});

index.screenshots.forEach(screenshot => {
  if (!screenshot.caption) {
    return; // Skip screenshots without captions
  }

  totalScreenshots++;
  const caption = screenshot.caption.toLowerCase();
  let matched = false;

  // Check each category
  for (const [categoryName, categoryData] of Object.entries(categories)) {
    const keywords = categoryData.keywords || [];
    const detectedKeywords = [];

    keywords.forEach(keyword => {
      if (caption.includes(keyword.toLowerCase())) {
        detectedKeywords.push(keyword);
      }
    });

    if (detectedKeywords.length > 0 && !matched) {
      // Match found!
      usage[categoryName].count++;
      usage[categoryName].instances.push({
        screenshot_id: screenshot.id,
        timestamp: screenshot.timestamp,
        detected_keywords: detectedKeywords,
        confidence: detectedKeywords.length / keywords.length
      });

      console.log(`✅ Screenshot ${screenshot.id.substring(0, 8)}... → ${categoryName.toUpperCase()}`);
      console.log(`   Keywords: ${detectedKeywords.join(', ')}`);
      console.log(`   Caption: "${screenshot.caption.substring(0, 100)}..."\n`);

      matched = true;
      break;
    }
  }

  if (!matched) {
    // No match found, categorize as "other"
    usage['other'].count++;
    usage['other'].instances.push({
      screenshot_id: screenshot.id,
      timestamp: screenshot.timestamp,
      detected_keywords: [],
      confidence: 0.1
    });

    console.log(`⚠️  Screenshot ${screenshot.id.substring(0, 8)}... → OTHER (no keywords matched)`);
    console.log(`   Caption: "${screenshot.caption.substring(0, 100)}..."\n`);
  }
});

// Calculate percentages
Object.keys(usage).forEach(category => {
  usage[category].percentage = (usage[category].count / totalScreenshots) * 100;
});

// Create usage data for John Doe
const johnDoeData = {
  employee_id: 'john_doe',
  last_updated: new Date().toISOString(),
  total_screenshots: totalScreenshots,
  software_usage: usage,
  timeline: [
    {
      date: new Date().toISOString().split('T')[0],
      screenshots: totalScreenshots,
      most_used: Object.entries(usage)
        .sort(([, a], [, b]) => b.count - a.count)[0][0]
    }
  ]
};

// Save to file
const outputPath = path.join(__dirname, '../src-tauri/employees/john_doe_usage.json');
fs.writeFileSync(outputPath, JSON.stringify(johnDoeData, null, 2));

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 ANALYSIS COMPLETE for John Doe');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`Total Screenshots Analyzed: ${totalScreenshots}\n`);

console.log('Software Usage Breakdown:');
Object.entries(usage)
  .filter(([, data]) => data.count > 0)
  .sort(([, a], [, b]) => b.count - a.count)
  .forEach(([category, data]) => {
    console.log(`  ${categories[category]?.icon || '📄'} ${category.toUpperCase()}: ${data.count} (${data.percentage.toFixed(1)}%)`);
  });

console.log(`\n✅ Data saved to: ${outputPath}`);
console.log('\n🎉 John Doe\'s real usage data is ready!');
