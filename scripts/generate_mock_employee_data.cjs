const fs = require('fs');
const path = require('path');

const categories = [
  'browsers',
  'code_editors',
  'social_media',
  'communication',
  'productivity',
  'email',
  'design',
  'terminal',
  'media'
];

function generateMockUsage(employeeId, totalScreenshots) {
  const usage = {};
  const distribution = [];

  // Generate random distribution
  let remaining = totalScreenshots;
  categories.forEach((category, index) => {
    const isLast = index === categories.length - 1;
    const count = isLast ? remaining : Math.floor(Math.random() * (remaining * 0.4));
    remaining -= count;
    distribution.push({ category, count });
  });

  // Shuffle to make it more realistic
  distribution.sort(() => Math.random() - 0.5);

  // Create usage object
  distribution.forEach(({ category, count }) => {
    usage[category] = {
      count,
      percentage: (count / totalScreenshots) * 100,
      instances: []
    };
  });

  return {
    employee_id: employeeId,
    last_updated: new Date().toISOString(),
    total_screenshots: totalScreenshots,
    software_usage: usage,
    timeline: [
      {
        date: new Date().toISOString().split('T')[0],
        screenshots: totalScreenshots,
        most_used: distribution.sort((a, b) => b.count - a.count)[0].category
      }
    ]
  };
}

// Generate for each mock employee
const mockEmployees = [
  { id: 'john_smith', screenshots: 35 },
  { id: 'jane_williams', screenshots: 42 },
  { id: 'michael_johnson', screenshots: 28 },
  { id: 'sarah_brown', screenshots: 51 },
  { id: 'david_miller', screenshots: 33 }
];

mockEmployees.forEach(({ id, screenshots }) => {
  const data = generateMockUsage(id, screenshots);
  const outputPath = path.join(__dirname, `../src-tauri/employees/${id}_usage.json`);

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`✅ Generated mock data for ${id} (${screenshots} screenshots)`);
});

console.log('\n🎉 All mock employee data generated successfully!');
