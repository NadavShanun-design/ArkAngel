# UI-TARS Desktop Integration Plan for ArkAngel

## Executive Summary

This document outlines the complete technical plan to integrate ByteDance's UI-TARS Desktop into ArkAngel, replacing the incomplete Anthropic-only implementation with a production-ready, multi-provider computer control system.

**Goals:**
1. Support multiple AI providers (OpenAI GPT-4, Anthropic Claude, Gemini, Grok, etc.)
2. Enable real computer control (mouse, keyboard, screenshots)
3. Provide interactive chat interface for agent commands
4. Maintain ArkAngel's existing architecture (Tauri + React)

---

## Part 1: Architecture Analysis

### Current State (Incorrect Implementation)
- **File**: `src-tauri/src/computer_use.rs`
- **Problem**: Direct Anthropic API integration, Claude-only, no UI-TARS
- **Status**: Must be completely replaced

### Target State (Correct Implementation)
- **UI-TARS Location**: `/Users/nadavshanun/Downloads/ArkAngel2/UI-TARS-desktop-main/`
- **Integration Method**: Library-based integration using `@ui-tars/sdk`
- **Architecture**: Node.js service wrapper → Tauri IPC → React UI

### UI-TARS Desktop Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ArkAngel Frontend (React)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   Advanced Settings > Agent Section                   │   │
│  │   - Provider Selection (OpenAI, Claude, etc.)        │   │
│  │   - API Key Input                                     │   │
│  │   - Model Selection                                   │   │
│  │   - Chat Interface                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ Tauri IPC
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  Tauri Backend (Rust)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   Tauri Commands:                                     │   │
│  │   - start_uitars_agent()                             │   │
│  │   - stop_uitars_agent()                              │   │
│  │   - send_uitars_command()                            │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ Spawns Node.js process
                         ↓
┌─────────────────────────────────────────────────────────────┐
│           UI-TARS Service (Node.js/TypeScript)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   @ui-tars/sdk GUIAgent                              │   │
│  │   - Multi-provider model abstraction                 │   │
│  │   - NutJS operator (cross-platform control)          │   │
│  │   - Screenshot capture & processing                  │   │
│  │   - Action execution (click, type, scroll, etc.)     │   │
│  │   - Event streaming (onData, onError)               │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ OpenAI-compatible API
                         ↓
┌─────────────────────────────────────────────────────────────┐
│               AI Model Providers                             │
│   OpenAI  │  Anthropic  │  Gemini  │  Grok  │  Volcengine  │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 2: Detailed Technical Implementation Plan

### Phase 1: Project Setup and Dependency Installation

#### Step 1.1: Install UI-TARS SDK Dependencies

**Location**: Root `package.json`

**Action**:
```bash
cd /Users/nadavshanun/Downloads/ArkAngel2
npm install --save \
  @ui-tars/sdk@latest \
  @ui-tars/operator-nut-js@latest \
  openai@^5.5.1
```

**Dependencies Breakdown:**
- `@ui-tars/sdk`: Core GUIAgent orchestration
- `@ui-tars/operator-nut-js`: Cross-platform desktop control (NutJS)
- `openai`: OpenAI client (used for all OpenAI-compatible providers)

**Expected**: These packages will be added to `node_modules/` and `package.json`

---

#### Step 1.2: Verify UI-TARS Desktop Files

**Action**: Check that the UI-TARS codebase is present:
```bash
ls -la /Users/nadavshanun/Downloads/ArkAngel2/UI-TARS-desktop-main/
```

**Expected Files:**
- `packages/ui-tars/sdk/` - Core SDK
- `packages/ui-tars/operators/nut-js/` - Desktop operator
- `apps/ui-tars/` - Desktop application reference

---

### Phase 2: Remove Incorrect Implementation

#### Step 2.1: Delete Anthropic-Only Code

**Files to Remove:**
1. `src-tauri/src/computer_use.rs` - Complete file deletion
2. Remove from `src-tauri/src/lib.rs`:
   - `mod computer_use;`
   - `computer_use::execute_computer_command` from `invoke_handler!()`

**Action in lib.rs**:
```rust
// REMOVE these lines:
mod computer_use;

// In invoke_handler, REMOVE:
computer_use::execute_computer_command,
```

---

### Phase 3: Create UI-TARS Service Wrapper

#### Step 3.1: Create Service Directory Structure

**Create Directory:**
```
src-tauri/uitars-service/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # Main entry point
│   ├── agent.ts          # GUIAgent wrapper
│   ├── config.ts         # Provider configurations
│   └── types.ts          # TypeScript types
```

---

#### Step 3.2: Create package.json

**File**: `src-tauri/uitars-service/package.json`

```json
{
  "name": "arkangel-uitars-service",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@ui-tars/sdk": "latest",
    "@ui-tars/operator-nut-js": "latest",
    "openai": "^5.5.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0"
  }
}
```

---

#### Step 3.3: Create TypeScript Config

**File**: `src-tauri/uitars-service/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

#### Step 3.4: Create Types Definition

**File**: `src-tauri/uitars-service/src/types.ts`

```typescript
export interface UITarsConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'grok' | 'volcengine' | 'custom';
  apiKey: string;
  model: string;
  baseURL?: string;
}

export interface ExecuteCommandRequest {
  instruction: string;
  config: UITarsConfig;
}

export interface ExecuteCommandResponse {
  success: boolean;
  message: string;
  status: 'running' | 'completed' | 'error' | 'stopped';
  conversations?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  screenshot?: string; // base64
  action?: string;
  error?: string;
}

export interface AgentStatus {
  isRunning: boolean;
  currentTask?: string;
  loopCount: number;
  maxLoops: number;
}
```

---

#### Step 3.5: Create Provider Config

**File**: `src-tauri/uitars-service/src/config.ts`

```typescript
import type { UITarsConfig } from './types.js';

export const PROVIDER_CONFIGS: Record<string, Partial<UITarsConfig>> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    model: 'claude-3-7-sonnet-latest',
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash-exp',
  },
  grok: {
    baseURL: 'https://api.x.ai/v1',
    model: 'grok-2-vision-1212',
  },
  volcengine: {
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-1-5-thinking-vision-pro-250428',
  },
};

export function getProviderConfig(config: UITarsConfig) {
  const baseConfig = PROVIDER_CONFIGS[config.provider] || {};

  return {
    baseURL: config.baseURL || baseConfig.baseURL,
    apiKey: config.apiKey,
    model: config.model || baseConfig.model,
  };
}
```

---

#### Step 3.6: Create Agent Wrapper

**File**: `src-tauri/uitars-service/src/agent.ts`

```typescript
import { GUIAgent } from '@ui-tars/sdk';
import { NutJSOperator } from '@ui-tars/operator-nut-js';
import type {
  UITarsConfig,
  ExecuteCommandResponse,
  AgentStatus
} from './types.js';
import { getProviderConfig } from './config.js';

export class UITarsAgentService {
  private agent: GUIAgent<NutJSOperator> | null = null;
  private abortController: AbortController | null = null;
  private status: AgentStatus = {
    isRunning: false,
    loopCount: 0,
    maxLoops: 25,
  };

  async executeCommand(
    instruction: string,
    config: UITarsConfig,
    onUpdate?: (response: ExecuteCommandResponse) => void
  ): Promise<ExecuteCommandResponse> {
    // Stop any existing agent
    this.stop();

    // Create abort controller
    this.abortController = new AbortController();

    // Get provider config
    const modelConfig = getProviderConfig(config);

    // Initialize agent
    this.agent = new GUIAgent({
      model: modelConfig,
      operator: new NutJSOperator(),
      signal: this.abortController.signal,
      maxLoopCount: 25,
      loopIntervalInMs: 1000,

      onData: ({ data }) => {
        this.status.isRunning = true;
        this.status.loopCount = data.conversations.length;

        const response: ExecuteCommandResponse = {
          success: true,
          message: data.conversations[data.conversations.length - 1]?.content || '',
          status: data.status === 'END' ? 'completed' : 'running',
          conversations: data.conversations,
          screenshot: data.screenshot?.base64,
          action: data.parsedPrediction?.action,
        };

        onUpdate?.(response);
      },

      onError: ({ error, data }) => {
        this.status.isRunning = false;

        const response: ExecuteCommandResponse = {
          success: false,
          message: error.message,
          status: 'error',
          error: error.message,
          conversations: data.conversations,
        };

        onUpdate?.(response);
      },
    });

    try {
      // Run the agent
      await this.agent.run(instruction);

      return {
        success: true,
        message: 'Task completed successfully',
        status: 'completed',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.status.isRunning = false;
    }
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.agent) {
      this.agent.stop();
      this.agent = null;
    }

    this.status.isRunning = false;
  }

  getStatus(): AgentStatus {
    return { ...this.status };
  }
}
```

---

#### Step 3.7: Create Main Entry Point

**File**: `src-tauri/uitars-service/src/index.ts`

```typescript
import { UITarsAgentService } from './agent.js';
import type { ExecuteCommandRequest, ExecuteCommandResponse } from './types.js';

const agent = new UITarsAgentService();

// Listen for commands via stdin
process.stdin.setEncoding('utf8');

let inputBuffer = '';

process.stdin.on('data', async (chunk: string) => {
  inputBuffer += chunk;

  const lines = inputBuffer.split('\n');
  inputBuffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const request: ExecuteCommandRequest = JSON.parse(line);

      await agent.executeCommand(
        request.instruction,
        request.config,
        (response: ExecuteCommandResponse) => {
          // Send updates to stdout
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      );
    } catch (error) {
      const errorResponse: ExecuteCommandResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to parse command',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }
});

process.stdin.on('end', () => {
  agent.stop();
  process.exit(0);
});

// Handle termination signals
process.on('SIGINT', () => {
  agent.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  agent.stop();
  process.exit(0);
});

// Send ready signal
const readySignal: ExecuteCommandResponse = {
  success: true,
  message: 'UI-TARS service ready',
  status: 'completed',
};
process.stdout.write(JSON.stringify(readySignal) + '\n');
```

---

### Phase 4: Update Rust Backend

#### Step 4.1: Create Rust Module for UI-TARS

**File**: `src-tauri/src/uitars_agent.rs`

```rust
use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};
use std::io::{BufRead, BufReader, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UITarsConfig {
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteCommandRequest {
    pub instruction: String,
    pub config: UITarsConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteCommandResponse {
    pub success: bool,
    pub message: String,
    pub status: String,
    pub conversations: Option<Vec<Conversation>>,
    pub screenshot: Option<String>,
    pub action: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub role: String,
    pub content: String,
}

pub struct UITarsAgent {
    process: Arc<Mutex<Option<Child>>>,
}

impl UITarsAgent {
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
        }
    }

    pub fn spawn(&self) -> Result<(), String> {
        let mut process_guard = self.process.lock().unwrap();

        if process_guard.is_some() {
            return Err("Agent already running".to_string());
        }

        let service_path = std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
            .join("src-tauri/uitars-service");

        let child = Command::new("node")
            .arg("dist/index.js")
            .current_dir(&service_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn UI-TARS service: {}", e))?;

        *process_guard = Some(child);
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut process_guard = self.process.lock().unwrap();

        if let Some(mut child) = process_guard.take() {
            child.kill().map_err(|e| format!("Failed to kill process: {}", e))?;
            child.wait().map_err(|e| format!("Failed to wait for process: {}", e))?;
        }

        Ok(())
    }

    pub fn send_command(
        &self,
        request: ExecuteCommandRequest,
        app_handle: tauri::AppHandle,
    ) -> Result<(), String> {
        let process_guard = self.process.lock().unwrap();

        let child = process_guard
            .as_ref()
            .ok_or("Agent not running")?;

        // Get stdin
        let stdin = child.stdin.as_ref()
            .ok_or("Failed to get stdin")?;

        // Serialize request
        let request_json = serde_json::to_string(&request)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;

        // Send command
        let mut stdin_clone = stdin.try_clone()
            .map_err(|e| format!("Failed to clone stdin: {}", e))?;

        writeln!(stdin_clone, "{}", request_json)
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;

        // Read responses in a separate thread
        let stdout = child.stdout.as_ref()
            .ok_or("Failed to get stdout")?
            .try_clone()
            .map_err(|e| format!("Failed to clone stdout: {}", e))?;

        let reader = BufReader::new(stdout);

        thread::spawn(move || {
            for line in reader.lines() {
                if let Ok(line) = line {
                    if let Ok(response) = serde_json::from_str::<ExecuteCommandResponse>(&line) {
                        let _ = app_handle.emit("uitars-update", response);
                    }
                }
            }
        });

        Ok(())
    }
}

#[tauri::command]
pub async fn start_uitars_agent(
    state: tauri::State<'_, Arc<Mutex<UITarsAgent>>>,
) -> Result<String, String> {
    let agent = state.lock().unwrap();
    agent.spawn()?;
    Ok("Agent started".to_string())
}

#[tauri::command]
pub async fn stop_uitars_agent(
    state: tauri::State<'_, Arc<Mutex<UITarsAgent>>>,
) -> Result<String, String> {
    let agent = state.lock().unwrap();
    agent.stop()?;
    Ok("Agent stopped".to_string())
}

#[tauri::command]
pub async fn execute_uitars_command(
    instruction: String,
    config: UITarsConfig,
    state: tauri::State<'_, Arc<Mutex<UITarsAgent>>>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let agent = state.lock().unwrap();

    let request = ExecuteCommandRequest {
        instruction,
        config,
    };

    agent.send_command(request, app_handle)?;
    Ok("Command sent".to_string())
}
```

---

#### Step 4.2: Update lib.rs

**File**: `src-tauri/src/lib.rs`

```rust
// Add module declaration
mod uitars_agent;

use std::sync::{Arc, Mutex};
use uitars_agent::UITarsAgent;

// In the app builder, add state and commands:
pub fn run() {
    let uitars_agent = Arc::new(Mutex::new(UITarsAgent::new()));

    tauri::Builder::default()
        .manage(uitars_agent)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            // ... existing commands ...
            uitars_agent::start_uitars_agent,
            uitars_agent::stop_uitars_agent,
            uitars_agent::execute_uitars_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

### Phase 5: Update Frontend

#### Step 5.1: Update Advanced Settings Types

**File**: `src/types/agent.ts` (create new file)

```typescript
export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'grok' | 'volcengine' | 'custom';

export interface AgentConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseURL?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  screenshot?: string;
  action?: string;
}

export interface AgentUpdate {
  success: boolean;
  message: string;
  status: 'running' | 'completed' | 'error' | 'stopped';
  conversations?: Array<{
    role: string;
    content: string;
  }>;
  screenshot?: string;
  action?: string;
  error?: string;
}
```

---

#### Step 5.2: Update Advanced Settings Page

**File**: `src/components/advanced/AdvancedSettingsPage.tsx`

Key changes needed:
1. Add provider dropdown with all options (OpenAI, Anthropic, Gemini, Grok, etc.)
2. Dynamic model selection based on provider
3. Optional base URL field for custom providers
4. Update start/stop agent handlers to use new Tauri commands
5. Listen for `uitars-update` events and update chat in real-time

```typescript
// Provider configuration
const PROVIDERS: Record<AIProvider, { name: string; models: string[]; requiresBaseURL: boolean }> = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    requiresBaseURL: false,
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    models: ['claude-3-7-sonnet-latest', 'claude-3-5-sonnet-20241022', 'claude-3-opus-latest'],
    requiresBaseURL: false,
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro'],
    requiresBaseURL: false,
  },
  grok: {
    name: 'xAI Grok',
    models: ['grok-2-vision-1212', 'grok-beta'],
    requiresBaseURL: false,
  },
  volcengine: {
    name: 'Volcengine (Doubao)',
    models: ['doubao-1-5-thinking-vision-pro-250428', 'doubao-1-5-ui-tars'],
    requiresBaseURL: false,
  },
  custom: {
    name: 'Custom Provider',
    models: [],
    requiresBaseURL: true,
  },
};

// Event listener for agent updates
useEffect(() => {
  const unlisten = listen<AgentUpdate>('uitars-update', (event) => {
    const update = event.payload;

    if (update.conversations) {
      setMessages(update.conversations.map((conv, idx) => ({
        id: `msg-${Date.now()}-${idx}`,
        role: conv.role as 'user' | 'assistant' | 'system',
        content: conv.content,
        timestamp: Date.now(),
        screenshot: update.screenshot,
        action: update.action,
      })));
    }

    if (update.status === 'completed' || update.status === 'error') {
      setAgentStatus('stopped');
      setSending(false);
    }
  });

  return () => {
    unlisten.then(fn => fn());
  };
}, []);
```

---

### Phase 6: Build and Test

#### Step 6.1: Build UI-TARS Service

```bash
cd src-tauri/uitars-service
npm install
npm run build
```

**Expected Output**: `dist/` folder with compiled JavaScript

---

#### Step 6.2: Build Tauri Application

```bash
npm run tauri build
```

---

#### Step 6.3: Test with OpenAI GPT-4

1. Open Advanced Settings > Agent
2. Select "OpenAI" provider
3. Enter OpenAI API key
4. Select "gpt-4o" model
5. Click "Start Agent"
6. Send command: "Open Calculator app"
7. Verify agent executes the action

---

#### Step 6.4: Test with Anthropic Claude

1. Change provider to "Anthropic (Claude)"
2. Enter Anthropic API key
3. Select "claude-3-7-sonnet-latest"
4. Click "Start Agent"
5. Send command: "Take a screenshot and describe what you see"
6. Verify it works

---

## Part 3: Expected Capabilities

After implementation, the agent will support:

### Actions Supported:
1. **click(start_box="[x1, y1, x2, y2]")** - Click at coordinates
2. **left_double(start_box="[x1, y1, x2, y2]")** - Double click
3. **right_single(start_box="[x1, y1, x2, y2]")** - Right click
4. **drag(start_box, end_box)** - Drag and drop
5. **hotkey(key="Cmd+C")** - Press keyboard shortcuts
6. **type(content="text")** - Type text
7. **scroll(start_box, direction)** - Scroll in any direction
8. **wait()** - Wait before next action
9. **finished()** - Mark task complete
10. **call_user()** - Request user input

### Multi-Provider Support:
- ✅ OpenAI (GPT-4o, GPT-4 Turbo)
- ✅ Anthropic (Claude 3.7 Sonnet, Claude 3.5, Claude 3 Opus)
- ✅ Google Gemini (Gemini 2.0 Flash, Gemini 1.5 Pro)
- ✅ xAI Grok (Grok-2 Vision)
- ✅ Volcengine Doubao (ByteDance models)
- ✅ Custom OpenAI-compatible endpoints

---

## Part 4: Testing Checklist

- [ ] UI-TARS service builds successfully
- [ ] Rust backend compiles without errors
- [ ] Frontend provider dropdown shows all options
- [ ] OpenAI GPT-4o can control desktop
- [ ] Anthropic Claude can control desktop
- [ ] Real-time chat updates work
- [ ] Screenshots appear in chat
- [ ] Agent can be stopped mid-execution
- [ ] Error handling works properly
- [ ] Chat history persists in localStorage

---

## Part 5: Advantages Over Previous Implementation

| Feature | Old (Anthropic-only) | New (UI-TARS) |
|---------|---------------------|---------------|
| Provider Support | Anthropic only | 6+ providers |
| OpenAI GPT-4 | ❌ Not supported | ✅ Supported |
| Claude | ✅ Supported | ✅ Supported |
| Cross-platform | ⚠️ macOS only | ✅ Mac/Win/Linux |
| Screenshot Quality | Basic | High-resolution |
| Action Types | 5 actions | 10+ actions |
| Visual Grounding | None | Built-in |
| Error Recovery | Basic | Advanced retry logic |
| Community Support | None | ByteDance backed |
| Production Ready | ❌ No | ✅ Yes |

---

## Summary

This plan completely replaces the incorrect Anthropic-only implementation with a production-ready, multi-provider computer control system powered by ByteDance's UI-TARS Desktop.

**Next Steps:**
1. Remove incorrect `computer_use.rs` implementation
2. Install UI-TARS SDK dependencies
3. Create TypeScript service wrapper
4. Update Rust backend with subprocess management
5. Update frontend with multi-provider UI
6. Build and test with multiple providers

This implementation will give you **real**, **working** computer control that supports **OpenAI GPT-4, Anthropic Claude, and all other major AI providers**.
