#!/usr/bin/env node

// Simple test script to verify file operations
import fs from 'fs';
import path from 'path';

const uploadsDir = path.join(process.cwd(), 'uploads');
const indexPath = path.join(uploadsDir, 'index.json');

console.log('🧪 Testing File Management System...\n');

// Test 1: Check if uploads directory exists
console.log('1. Checking uploads directory...');
if (fs.existsSync(uploadsDir)) {
  console.log('✅ Uploads directory exists');
} else {
  console.log('❌ Uploads directory not found');
  process.exit(1);
}

// Test 2: Check if index.json exists and is readable
console.log('\n2. Checking index.json...');
if (fs.existsSync(indexPath)) {
  try {
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const files = JSON.parse(indexContent);
    console.log(`✅ Index.json exists with ${files.length} file(s)`);
    
    if (files.length > 0) {
      console.log('📁 Current files:');
      files.forEach((file, i) => {
        console.log(`   ${i + 1}. ${file.name} (ID: ${file.id})`);
        
        // Check if actual file exists
        const filePath = path.join(uploadsDir, file.id);
        if (fs.existsSync(filePath)) {
          console.log(`      ✅ File exists on disk`);
        } else {
          console.log(`      ❌ File missing on disk!`);
        }
      });
    }
  } catch (error) {
    console.log('❌ Failed to parse index.json:', error.message);
  }
} else {
  console.log('✅ Index.json does not exist (empty state)');
}

// Test 3: Check file permissions
console.log('\n3. Checking permissions...');
try {
  fs.accessSync(uploadsDir, fs.constants.R_OK | fs.constants.W_OK);
  console.log('✅ Uploads directory is readable and writable');
} catch (error) {
  console.log('❌ Permission issues with uploads directory:', error.message);
}

console.log('\n🎯 Test Summary:');
console.log('- File system structure appears correct');
console.log('- You can now test deletion via the UI');
console.log('- Check the terminal logs for detailed delete operations');