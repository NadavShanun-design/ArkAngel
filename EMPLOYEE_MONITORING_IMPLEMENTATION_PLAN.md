# Employee Monitoring Dashboard - Technical Implementation Plan

## 🎯 Project Overview

Create an intelligent employee monitoring system that:
1. Analyzes VLM screenshot captions to detect software usage
2. Uses a local LLM to categorize software from text descriptions
3. Tracks usage statistics per employee
4. Displays pie charts showing software usage percentages
5. Provides a dashboard with mock employees + real data for "John Doe"

---

## 📊 System Architecture

```
Screenshot Capture (Already Working)
    ↓
VLM Caption Generation (moondream - Already Working)
    ↓
Caption Text Extraction
    ↓
Local LLM Analysis (Phi-3-mini via Ollama - NEW)
    ↓
Software Detection & Categorization
    ↓
Usage Statistics Storage (JSON files)
    ↓
Employee Dashboard UI with Pie Charts
```

---

## 🤖 Local LLM Selection

### Chosen Model: **Phi-3-mini (3.8B parameters)**

**Why Phi-3-mini?**
- ✅ **Lightweight:** Only 3.8B parameters (2-3GB RAM)
- ✅ **Fast:** Optimized for CPU inference, ~100-200ms response time
- ✅ **Accurate:** Excellent at text classification and extraction
- ✅ **Ollama Support:** Easy to install via `ollama pull phi3:mini`
- ✅ **Low Latency:** Perfect for real-time categorization
- ✅ **Resource Efficient:** Runs alongside moondream without issues

**Alternative Options:**
- **TinyLlama (1.1B):** Faster but less accurate
- **Gemma 2B:** Good balance but larger
- **Mistral 7B:** More accurate but slower and heavier

**Hardware Requirements:**
- RAM: 4GB minimum (8GB recommended)
- CPU: Any modern processor
- GPU: Optional (will use if available)

---

## 📋 Software Categorization System

### Pre-defined Software Categories & Keywords

```json
{
  "browsers": {
    "keywords": ["chrome", "firefox", "safari", "edge", "browser", "google chrome", "web browser"],
    "icon": "🌐",
    "color": "#4285F4"
  },
  "code_editors": {
    "keywords": ["vscode", "visual studio code", "cursor", "sublime", "atom", "jetbrains", "pycharm", "webstorm", "intellij", "code editor"],
    "icon": "💻",
    "color": "#007ACC"
  },
  "social_media": {
    "keywords": ["linkedin", "facebook", "twitter", "x.com", "instagram", "reddit", "social media"],
    "icon": "📱",
    "color": "#0A66C2"
  },
  "communication": {
    "keywords": ["slack", "teams", "discord", "zoom", "meet", "skype", "messenger"],
    "icon": "💬",
    "color": "#E01E5A"
  },
  "productivity": {
    "keywords": ["notion", "trello", "asana", "jira", "monday", "excel", "sheets", "docs", "word"],
    "icon": "📊",
    "color": "#FF6B6B"
  },
  "email": {
    "keywords": ["gmail", "outlook", "mail", "email", "inbox"],
    "icon": "📧",
    "color": "#EA4335"
  },
  "design": {
    "keywords": ["figma", "photoshop", "illustrator", "sketch", "canva", "design tool"],
    "icon": "🎨",
    "color": "#F24E1E"
  },
  "terminal": {
    "keywords": ["terminal", "command", "cmd", "powershell", "bash", "shell"],
    "icon": "⚙️",
    "color": "#000000"
  },
  "media": {
    "keywords": ["youtube", "spotify", "netflix", "video player", "music"],
    "icon": "🎵",
    "color": "#FF0000"
  },
  "other": {
    "keywords": [],
    "icon": "📄",
    "color": "#999999"
  }
}
```

---

## 🗄️ Data Storage Schema

### File Structure

```
src-tauri/
  ├── workflows/
  │   ├── index.json                    # Screenshot metadata with captions
  │   └── screenshot_*.png              # Screenshot images
  ├── employees/
  │   ├── index.json                    # Employee list
  │   ├── john_doe_usage.json           # Real usage data
  │   ├── john_smith_usage.json         # Mock usage data
  │   └── ...
  └── software_categories.json          # Software categories & keywords
```

### employees/index.json Schema

```json
{
  "employees": [
    {
      "id": "john_doe",
      "name": "John Doe",
      "email": "john.doe@company.com",
      "avatar": "https://i.pravatar.cc/150?u=johndoe",
      "status": "active",
      "is_current_user": true
    },
    {
      "id": "john_smith",
      "name": "John Smith",
      "email": "john.smith@company.com",
      "avatar": "https://i.pravatar.cc/150?u=johnsmith",
      "status": "active",
      "is_current_user": false
    }
  ]
}
```

### employees/{employee_id}_usage.json Schema

```json
{
  "employee_id": "john_doe",
  "last_updated": "2025-11-11T21:53:01.034440+00:00",
  "total_screenshots": 15,
  "software_usage": {
    "browsers": {
      "count": 5,
      "percentage": 33.33,
      "instances": [
        {
          "screenshot_id": "c9036319-1209-48bf-80e7-bfb2aa797d75",
          "timestamp": "2025-11-11T21:52:56.471899+00:00",
          "detected_keywords": ["chrome", "browser"],
          "confidence": 0.95
        }
      ]
    },
    "code_editors": {
      "count": 8,
      "percentage": 53.33,
      "instances": [...]
    },
    "social_media": {
      "count": 2,
      "percentage": 13.34,
      "instances": [...]
    }
  },
  "timeline": [
    {
      "date": "2025-11-11",
      "screenshots": 15,
      "most_used": "code_editors"
    }
  ]
}
```

---

## 🛠️ Implementation Steps

### Phase 1: Setup Phi-3-mini Model

**Step 1.1: Download Phi-3-mini via Ollama**
```bash
ollama pull phi3:mini
```

**Step 1.2: Test Phi-3-mini**
```bash
ollama run phi3:mini "Analyze this text and identify any software mentioned: The screen shows a person using Visual Studio Code to edit JavaScript files."
```

**Expected Output:**
```
Software detected: Visual Studio Code (Code Editor)
```

---

### Phase 2: Backend - Software Analysis System

**Step 2.1: Create Rust Analysis Module**

File: `src-tauri/src/software_analyzer.rs`

```rust
use serde::{Deserialize, Serialize};
use reqwest;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct SoftwareCategory {
    pub name: String,
    pub keywords: Vec<String>,
    pub icon: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub category: String,
    pub detected_keywords: Vec<String>,
    pub confidence: f32,
}

pub async fn analyze_caption(
    caption: &str,
    ollama_url: &str,
) -> Result<AnalysisResult, String> {
    // Call Phi-3-mini via Ollama API
    let prompt = format!(
        "Analyze the following screenshot description and identify software being used. \
        Reply ONLY with the software name and category.\n\n\
        Description: {}\n\n\
        Software:",
        caption
    );

    // Make API call to Ollama
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/generate", ollama_url))
        .json(&serde_json::json!({
            "model": "phi3:mini",
            "prompt": prompt,
            "stream": false,
            "temperature": 0.1,
        }))
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    let ai_response = result["response"]
        .as_str()
        .unwrap_or("")
        .to_lowercase();

    // Match against predefined categories
    let categories = load_software_categories()?;
    let mut best_match: Option<(String, Vec<String>, f32)> = None;

    for (category, keywords) in categories {
        let mut matched_keywords = Vec::new();
        for keyword in keywords {
            if caption.to_lowercase().contains(&keyword)
                || ai_response.contains(&keyword) {
                matched_keywords.push(keyword.clone());
            }
        }

        if !matched_keywords.is_empty() {
            let confidence = matched_keywords.len() as f32 / keywords.len() as f32;
            if best_match.is_none() || confidence > best_match.as_ref().unwrap().2 {
                best_match = Some((category.clone(), matched_keywords, confidence));
            }
        }
    }

    if let Some((category, keywords, confidence)) = best_match {
        Ok(AnalysisResult {
            category,
            detected_keywords: keywords,
            confidence,
        })
    } else {
        Ok(AnalysisResult {
            category: "other".to_string(),
            detected_keywords: vec![],
            confidence: 0.1,
        })
    }
}

fn load_software_categories() -> Result<HashMap<String, Vec<String>>, String> {
    // Load from software_categories.json
    let categories_path = "software_categories.json";
    let content = std::fs::read_to_string(categories_path)
        .map_err(|e| format!("Failed to read categories: {}", e))?;

    let categories: HashMap<String, serde_json::Value> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse categories: {}", e))?;

    let mut result = HashMap::new();
    for (category, data) in categories {
        if let Some(keywords) = data["keywords"].as_array() {
            let keywords_vec: Vec<String> = keywords
                .iter()
                .filter_map(|k| k.as_str().map(|s| s.to_string()))
                .collect();
            result.insert(category, keywords_vec);
        }
    }

    Ok(result)
}
```

**Step 2.2: Add Tauri Command**

Add to `src-tauri/src/lib.rs`:

```rust
mod software_analyzer;

#[tauri::command]
async fn analyze_screenshot_caption(
    screenshot_id: String,
    ollama_url: String,
) -> Result<serde_json::Value, String> {
    // Load screenshot metadata
    let index_path = "workflows/index.json";
    let content = std::fs::read_to_string(index_path)
        .map_err(|e| format!("Failed to read index: {}", e))?;

    let mut index: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse index: {}", e))?;

    // Find screenshot by ID
    if let Some(screenshots) = index["screenshots"].as_array() {
        for screenshot in screenshots {
            if screenshot["id"].as_str() == Some(&screenshot_id) {
                if let Some(caption) = screenshot["caption"].as_str() {
                    // Analyze caption
                    let result = software_analyzer::analyze_caption(caption, &ollama_url).await?;
                    return Ok(serde_json::to_value(result).unwrap());
                }
            }
        }
    }

    Err("Screenshot not found or no caption available".to_string())
}

#[tauri::command]
async fn batch_analyze_screenshots(
    ollama_url: String,
) -> Result<serde_json::Value, String> {
    // Load all screenshots
    let index_path = "workflows/index.json";
    let content = std::fs::read_to_string(index_path)
        .map_err(|e| format!("Failed to read index: {}", e))?;

    let index: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse index: {}", e))?;

    let mut results = Vec::new();

    if let Some(screenshots) = index["screenshots"].as_array() {
        for screenshot in screenshots {
            if let Some(caption) = screenshot["caption"].as_str() {
                let id = screenshot["id"].as_str().unwrap_or("unknown");
                let result = software_analyzer::analyze_caption(caption, &ollama_url).await?;

                results.push(serde_json::json!({
                    "screenshot_id": id,
                    "timestamp": screenshot["timestamp"],
                    "analysis": result,
                }));
            }
        }
    }

    Ok(serde_json::json!({ "results": results }))
}

// Register commands in setup
fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing commands ...
            analyze_screenshot_caption,
            batch_analyze_screenshots,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

### Phase 3: Frontend - Employee Dashboard

**Step 3.1: Create Employee Types**

File: `src/types/employee.ts`

```typescript
export interface Employee {
  id: string;
  name: string;
  email: string;
  avatar: string;
  status: 'active' | 'inactive';
  is_current_user: boolean;
}

export interface SoftwareUsageInstance {
  screenshot_id: string;
  timestamp: string;
  detected_keywords: string[];
  confidence: number;
}

export interface SoftwareCategoryUsage {
  count: number;
  percentage: number;
  instances: SoftwareUsageInstance[];
}

export interface EmployeeUsageData {
  employee_id: string;
  last_updated: string;
  total_screenshots: number;
  software_usage: Record<string, SoftwareCategoryUsage>;
  timeline: Array<{
    date: string;
    screenshots: number;
    most_used: string;
  }>;
}
```

**Step 3.2: Create Employees Page**

File: `src/components/employees/EmployeesPage.tsx`

```typescript
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Employee, EmployeeUsageData } from '@/types/employee';

const COLORS = {
  browsers: '#4285F4',
  code_editors: '#007ACC',
  social_media: '#0A66C2',
  communication: '#E01E5A',
  productivity: '#FF6B6B',
  email: '#EA4335',
  design: '#F24E1E',
  terminal: '#000000',
  media: '#FF0000',
  other: '#999999',
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [usageData, setUsageData] = useState<EmployeeUsageData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await invoke<{ employees: Employee[] }>('get_employees');
      setEmployees(data.employees);

      // Auto-select John Doe (current user)
      const johnDoe = data.employees.find(e => e.is_current_user);
      if (johnDoe) {
        setSelectedEmployee(johnDoe);
        loadEmployeeUsage(johnDoe.id);
      }
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const loadEmployeeUsage = async (employeeId: string) => {
    setLoading(true);
    try {
      const data = await invoke<EmployeeUsageData>('get_employee_usage', { employeeId });
      setUsageData(data);
    } catch (error) {
      console.error('Failed to load employee usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
    loadEmployeeUsage(employee.id);
  };

  const getPieChartData = () => {
    if (!usageData) return [];

    return Object.entries(usageData.software_usage)
      .filter(([_, data]) => data.count > 0)
      .map(([category, data]) => ({
        name: category.replace('_', ' ').toUpperCase(),
        value: data.percentage,
        count: data.count,
      }));
  };

  return (
    <div className="flex h-full">
      {/* Employee List Sidebar */}
      <div className="w-64 border-r border-border bg-background/50 p-4">
        <h2 className="text-lg font-semibold mb-4">Employees</h2>
        <div className="space-y-2">
          {employees.map(employee => (
            <button
              key={employee.id}
              onClick={() => handleEmployeeSelect(employee)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                selectedEmployee?.id === employee.id
                  ? 'bg-primary/20 border border-primary'
                  : 'bg-background hover:bg-accent'
              }`}
            >
              <img
                src={employee.avatar}
                alt={employee.name}
                className="w-10 h-10 rounded-full"
              />
              <div className="flex-1 text-left">
                <div className="font-medium text-sm">{employee.name}</div>
                <div className="text-xs text-muted-foreground">{employee.email}</div>
              </div>
              {employee.is_current_user && (
                <span className="text-xs bg-green-500/20 text-green-600 px-2 py-1 rounded">
                  You
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Usage Dashboard */}
      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading usage data...</div>
          </div>
        ) : selectedEmployee && usageData ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <img
                src={selectedEmployee.avatar}
                alt={selectedEmployee.name}
                className="w-16 h-16 rounded-full"
              />
              <div>
                <h1 className="text-2xl font-bold">{selectedEmployee.name}</h1>
                <p className="text-muted-foreground">{selectedEmployee.email}</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-background/50 border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Total Screenshots</div>
                <div className="text-3xl font-bold mt-1">{usageData.total_screenshots}</div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Most Used</div>
                <div className="text-xl font-semibold mt-1">
                  {Object.entries(usageData.software_usage)
                    .sort(([, a], [, b]) => b.count - a.count)[0]?.[0]
                    ?.replace('_', ' ')
                    .toUpperCase() || 'N/A'}
                </div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Last Updated</div>
                <div className="text-sm mt-1">
                  {new Date(usageData.last_updated).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Pie Chart */}
            <div className="bg-background/50 border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Software Usage Distribution</h2>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={getPieChartData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {getPieChartData().map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[entry.name.toLowerCase().replace(' ', '_')] || '#999999'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, props: any) =>
                      [`${value.toFixed(1)}% (${props.payload.count} screenshots)`, name]
                    }
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Breakdown */}
            <div className="bg-background/50 border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Detailed Breakdown</h2>
              <div className="space-y-4">
                {Object.entries(usageData.software_usage)
                  .filter(([_, data]) => data.count > 0)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([category, data]) => (
                    <div key={category} className="flex items-center gap-4">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: COLORS[category] }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">
                          {category.replace('_', ' ').toUpperCase()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {data.count} screenshots ({data.percentage.toFixed(1)}%)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono">
                          {data.detected_keywords.join(', ')}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Select an employee to view their usage data</div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3.3: Add Navigation Route**

Update `src/App.tsx` or main router to add Employees page:

```typescript
import EmployeesPage from '@/components/employees/EmployeesPage';

// Add to routes
<Route path="/employees" element={<EmployeesPage />} />

// Add to hamburger menu
{
  name: 'Employees',
  icon: '👥',
  path: '/employees',
}
```

---

### Phase 4: Data Processing & Analysis

**Step 4.1: Create Background Analysis Job**

File: `src-tauri/src/employee_analytics.rs`

```rust
use std::collections::HashMap;
use serde_json;

pub async fn process_all_screenshots_for_employee(
    employee_id: &str,
    ollama_url: &str,
) -> Result<(), String> {
    // Load screenshots
    let index = load_screenshot_index()?;

    let mut usage_stats: HashMap<String, Vec<AnalysisResult>> = HashMap::new();

    // Analyze each screenshot
    for screenshot in index["screenshots"].as_array().unwrap() {
        if let Some(caption) = screenshot["caption"].as_str() {
            let analysis = software_analyzer::analyze_caption(caption, ollama_url).await?;

            usage_stats
                .entry(analysis.category.clone())
                .or_insert_with(Vec::new)
                .push(AnalysisResult {
                    screenshot_id: screenshot["id"].as_str().unwrap().to_string(),
                    timestamp: screenshot["timestamp"].as_str().unwrap().to_string(),
                    detected_keywords: analysis.detected_keywords,
                    confidence: analysis.confidence,
                });
        }
    }

    // Calculate percentages
    let total = usage_stats.values().map(|v| v.len()).sum::<usize>() as f32;
    let mut software_usage = HashMap::new();

    for (category, instances) in usage_stats {
        let count = instances.len();
        let percentage = (count as f32 / total) * 100.0;

        software_usage.insert(category, serde_json::json!({
            "count": count,
            "percentage": percentage,
            "instances": instances,
        }));
    }

    // Save usage data
    let usage_data = serde_json::json!({
        "employee_id": employee_id,
        "last_updated": chrono::Utc::now().to_rfc3339(),
        "total_screenshots": total as i32,
        "software_usage": software_usage,
    });

    save_employee_usage(employee_id, &usage_data)?;

    Ok(())
}
```

---

### Phase 5: Mock Data Generation

**Step 5.1: Create Mock Employees**

File: `src-tauri/employees/index.json`

```json
{
  "employees": [
    {
      "id": "john_doe",
      "name": "John Doe",
      "email": "john.doe@company.com",
      "avatar": "https://i.pravatar.cc/150?u=johndoe",
      "status": "active",
      "is_current_user": true
    },
    {
      "id": "john_smith",
      "name": "John Smith",
      "email": "john.smith@company.com",
      "avatar": "https://i.pravatar.cc/150?u=johnsmith",
      "status": "active",
      "is_current_user": false
    },
    {
      "id": "jane_williams",
      "name": "Jane Williams",
      "email": "jane.williams@company.com",
      "avatar": "https://i.pravatar.cc/150?u=janewilliams",
      "status": "active",
      "is_current_user": false
    },
    {
      "id": "michael_johnson",
      "name": "Michael Johnson",
      "email": "michael.johnson@company.com",
      "avatar": "https://i.pravatar.cc/150?u=michaeljohnson",
      "status": "active",
      "is_current_user": false
    },
    {
      "id": "sarah_brown",
      "name": "Sarah Brown",
      "email": "sarah.brown@company.com",
      "avatar": "https://i.pravatar.cc/150?u=sarahbrown",
      "status": "active",
      "is_current_user": false
    },
    {
      "id": "david_miller",
      "name": "David Miller",
      "email": "david.miller@company.com",
      "avatar": "https://i.pravatar.cc/150?u=davidmiller",
      "status": "active",
      "is_current_user": false
    }
  ]
}
```

**Step 5.2: Generate Mock Usage Data**

Create script: `scripts/generate_mock_data.js`

```javascript
const fs = require('fs');
const path = require('path');

const categories = ['browsers', 'code_editors', 'social_media', 'communication', 'productivity', 'email'];

function generateMockUsage(employeeId, totalScreenshots) {
  const usage = {};
  let remaining = totalScreenshots;

  categories.forEach((category, index) => {
    const isLast = index === categories.length - 1;
    const count = isLast ? remaining : Math.floor(Math.random() * remaining);
    remaining -= count;

    usage[category] = {
      count,
      percentage: (count / totalScreenshots) * 100,
      instances: [],
    };
  });

  return {
    employee_id: employeeId,
    last_updated: new Date().toISOString(),
    total_screenshots: totalScreenshots,
    software_usage: usage,
  };
}

// Generate for each mock employee
['john_smith', 'jane_williams', 'michael_johnson', 'sarah_brown', 'david_miller'].forEach(id => {
  const data = generateMockUsage(id, Math.floor(Math.random() * 50) + 20);
  fs.writeFileSync(
    path.join(__dirname, `../src-tauri/employees/${id}_usage.json`),
    JSON.stringify(data, null, 2)
  );
  console.log(`Generated mock data for ${id}`);
});
```

---

## 📦 Dependencies to Install

### Backend (Cargo.toml)
```toml
[dependencies]
reqwest = { version = "0.11", features = ["json"] }
chrono = "0.4"
```

### Frontend (package.json)
```json
{
  "dependencies": {
    "recharts": "^2.10.3"
  }
}
```

---

## 🚀 Deployment Steps

### Step 1: Install Phi-3-mini
```bash
ollama pull phi3:mini
```

### Step 2: Create Directory Structure
```bash
mkdir -p src-tauri/employees
mkdir -p src-tauri/workflows
```

### Step 3: Create Software Categories File
```bash
# Copy software categories JSON to src-tauri/software_categories.json
```

### Step 4: Install Dependencies
```bash
# Frontend
npm install recharts

# Backend - add to Cargo.toml then
cd src-tauri
cargo build
```

### Step 5: Generate Mock Data
```bash
node scripts/generate_mock_data.js
```

### Step 6: Run Analysis Job
```bash
# From Tauri app or via command
ollama run phi3:mini
```

### Step 7: Test the System
```bash
npm run tauri dev
```

---

## 🧪 Testing Checklist

- [ ] Phi-3-mini installed and running
- [ ] Software categories file created
- [ ] Employee directory structure exists
- [ ] Mock employee data generated
- [ ] Employees page loads
- [ ] Employee list displays 6 people
- [ ] Can select John Doe (real data)
- [ ] Pie chart renders with actual screenshot data
- [ ] Can select other employees (mock data)
- [ ] Software detection works on VLM captions
- [ ] Percentages add up to 100%
- [ ] Colors match categories
- [ ] Detailed breakdown shows keywords

---

## ⚡ Performance Optimization

### Caching Strategy
- Cache Phi-3-mini analysis results in screenshot metadata
- Only re-analyze if caption changes
- Batch process multiple screenshots at once

### Background Processing
- Run analysis in background after screenshot capture
- Don't block UI during analysis
- Show loading states

### Memory Management
- Limit number of screenshots analyzed per session
- Use pagination for large datasets
- Clear old analysis results after 30 days

---

## 📊 Expected Output

### John Doe (Real Data) Example:
```
Total Screenshots: 6
Software Usage:
- Code Editors: 50% (3 screenshots) - cursor, vscode
- Browsers: 33% (2 screenshots) - chrome, browser
- Design: 17% (1 screenshot) - figma
```

### Pie Chart Visualization:
- Blue slice (50%): CODE EDITORS
- Gray slice (33%): BROWSERS
- Pink slice (17%): DESIGN

---

## 🔧 Configuration

### Ollama URL
Default: `http://localhost:11434`
Configurable in Settings → Advanced Settings

### Analysis Interval
- Real-time: After each screenshot
- Batch: Every 5 minutes
- Manual: On-demand button

### Keywords Management
- Editable via Settings
- Auto-learn new keywords from AI suggestions
- Export/Import keyword lists

---

## 📝 User Actions Required

### On Your End:

1. **Install Phi-3-mini:**
   ```bash
   ollama pull phi3:mini
   ```

2. **Wait for implementation** (I'll handle everything else)

3. **Test the Employees page:**
   - Click "Employees" in hamburger menu
   - Select "John Doe" to see real data
   - Verify pie chart shows actual software usage

4. **Verify Ollama is running:**
   ```bash
   ollama list
   # Should show phi3:mini
   ```

---

## ✅ Success Criteria

1. ✅ Phi-3-mini model running locally
2. ✅ Employees page added to navigation
3. ✅ 6 mock employees displayed
4. ✅ John Doe shows real usage data from VLM captions
5. ✅ Pie chart renders correctly with percentages
6. ✅ Software categories detected from keywords
7. ✅ New software automatically categorized
8. ✅ Performance <1 second for analysis per screenshot
9. ✅ UI responsive and polished
10. ✅ Background analysis doesn't block main thread

---

## 🎉 Next Steps After Implementation

1. Click "Employees" in menu
2. See list of 6 employees
3. Select "John Doe" (marked as "You")
4. View pie chart with real data
5. See detailed breakdown
6. Select other employees to see mock data
7. Watch as new screenshots automatically update stats

---

**Status:** 📋 PLAN COMPLETE - Ready for implementation!

**Estimated Time:** 2-3 hours for full implementation

**Start with:** Installing Phi-3-mini model
