# UI-TARS Agent Integration - Complete ✓

## Overview

Successfully integrated UI-TARS Desktop computer use agent into ArkAngel's Advanced Settings. The agent allows autonomous computer control via foundation models (Claude, GPT-4, etc.).

---

## What Was Created

### 1. **Frontend UI (React/TypeScript)**

**File:** `src/components/advanced/AdvancedSettingsPage.tsx`

**New "Agent" Section** in Advanced Settings with:
- ✅ Provider selection (Anthropic, OpenAI, Hugging Face, VolcEngine)
- ✅ API key input (password-protected)
- ✅ Model name configuration
- ✅ Base URL configuration
- ✅ Agent status indicator (Running/Stopped/Starting/Error)
- ✅ Start/Stop controls
- ✅ Test connection button
- ✅ macOS permissions checker
- ✅ Error display system
- ✅ Info section with safety warnings

**Storage:** Configuration saved to `localStorage` under key `agent-config`

---

### 2. **Backend Rust Module**

**File:** `src-tauri/src/agent_manager.rs`

**Features:**
- Process management for UI-TARS CLI
- State tracking (running/stopped)
- Permission checking (macOS Screen Recording & Accessibility)
- Configuration validation
- npx/Node.js availability check

**Tauri Commands Exposed:**
```rust
check_agent_permissions() -> Result<bool, String>
start_agent(provider, api_key, model, base_url) -> Result<String, String>
stop_agent() -> Result<String, String>
test_agent(provider, api_key, model, base_url) -> Result<String, String>
get_agent_status() -> Result<bool, String>
```

**Integration:** Added to `src-tauri/src/lib.rs` with state management

---

## How It Works

### Architecture

```
User configures agent in Advanced Settings
  ↓
Frontend saves config to localStorage
  ↓
User clicks "Start Agent"
  ↓
Frontend calls Tauri command: start_agent(config)
  ↓
Rust backend spawns: npx @ui-tars/cli@latest start --provider=... --model=... --apiKey=...
  ↓
UI-TARS agent runs in background (headless mode)
  ↓
Agent controls computer via Screen Recording + Accessibility APIs
  ↓
Frontend polls get_agent_status() to update UI
```

### Agent Providers Supported

1. **Anthropic (Claude)**
   - Base URL: `https://api.anthropic.com/v1`
   - Default Model: `claude-3-7-sonnet-latest`
   - Auth Type: Bearer Token

2. **OpenAI (GPT)**
   - Base URL: `https://api.openai.com/v1`
   - Default Model: `gpt-4o`
   - Auth Type: Bearer Token

3. **Hugging Face (UI-TARS-1.5)**
   - Base URL: `https://xxx.endpoints.huggingface.cloud/v1/`
   - Default Model: `UI-TARS-1.5-7B`
   - Requires Hugging Face endpoint setup

4. **VolcEngine (Doubao-1.5-UI-TARS)**
   - Base URL: `https://ark.cn-beijing.volces.com/api/v3`
   - Default Model: `doubao-1.5-ui-tars-250328`
   - China-based model service

---

## Prerequisites

### Required Software

1. **Node.js >= 22**
   ```bash
   node --version  # Should be >= 22
   ```

2. **npx (comes with Node.js)**
   ```bash
   npx --version
   ```

3. **UI-TARS CLI** (auto-installed via npx)
   - No manual installation needed
   - Uses `npx @ui-tars/cli@latest`

### macOS Permissions

Before starting the agent, grant these permissions in **System Settings > Privacy & Security**:

- ✅ **Screen Recording** (for the agent to see the screen)
- ✅ **Accessibility** (for mouse/keyboard control)

The UI will show a warning if permissions aren't granted.

---

## How to Use

### Step 1: Open Advanced Settings

1. Open ArkAngel
2. Click the Settings icon (⚙️)
3. Click "Advanced Settings" or "View Personal Information"
4. Navigate to the **"Agent"** section in the sidebar

### Step 2: Configure the Agent

1. **Select Provider:** Choose from Anthropic, OpenAI, Hugging Face, or VolcEngine
2. **Enter API Key:** Paste your provider's API key (e.g., `sk-...`)
3. **Customize Model** (optional): Change the model name if needed
4. **Customize Base URL** (optional): For custom endpoints or proxies

### Step 3: Test Configuration

Click **"Test Connection"** to verify:
- ✓ API key is valid
- ✓ Model name is correct
- ✓ Base URL is accessible
- ✓ npx is installed

### Step 4: Start the Agent

1. Click **"Start Agent"**
2. Status will change to "Starting..." then "Running"
3. Agent process spawns in background
4. Agent can now control your computer via natural language

### Step 5: Stop the Agent

Click **"Stop Agent"** to terminate the agent process.

---

## Safety Recommendations

⚠️ **IMPORTANT:** The agent has full control of your computer when running.

### Best Practices

1. **Use in a VM** (Parallels, VMware, VirtualBox)
   - Isolates agent from your main system
   - Prevents accidental damage to important data

2. **Dedicated Display/Space**
   - Run agent on second monitor
   - Use separate macOS Space

3. **Shared Folder Approach**
   - Create `/Users/you/AI-Workdrop` folder
   - Only give agent access to this folder
   - Keep sensitive data elsewhere

4. **Start Small**
   - Test with simple tasks first
   - Example: "Open Calculator and add 2 + 2"
   - Example: "Open Chrome and search for 'weather'"

5. **Monitor Activity**
   - Watch the agent's actions
   - Keep emergency stop (Cmd+Q) ready
   - Check logs for errors

---

## Configuration Storage

**Location:** Browser localStorage (same as ArkAngel settings)

**Key:** `agent-config`

**Data Structure:**
```json
{
  "provider": "anthropic",
  "apiKey": "sk-...",
  "model": "claude-3-7-sonnet-latest",
  "baseUrl": "https://api.anthropic.com/v1",
  "enabled": false
}
```

**Privacy:** API keys stored locally, never sent to ArkAngel servers.

---

## Example Use Cases

### 1. Browser Automation
```
"Open Chrome and go to GitHub, then star the ArkAngel repository"
```

### 2. File Management
```
"Create a new folder called 'Meeting Notes' on my Desktop"
```

### 3. App Control
```
"Open Calculator and compute the square root of 144"
```

### 4. Data Entry
```
"Open Excel, create a new sheet, and add the numbers 1-10 in column A"
```

### 5. Research
```
"Search Google for 'Tauri desktop apps' and save the first result to a text file"
```

---

## Troubleshooting

### Agent Won't Start

**Error:** `"npx is not installed or not in PATH"`
- **Solution:** Install Node.js >= 22 from [nodejs.org](https://nodejs.org)

**Error:** `"Please grant Screen Recording and Accessibility permissions"`
- **Solution:** System Settings > Privacy & Security > Grant permissions

**Error:** `"Failed to spawn agent process"`
- **Solution:** Run `npx @ui-tars/cli@latest` manually to see detailed error

### Test Connection Fails

**Error:** `"API key is required"`
- **Solution:** Enter your API key in the password field

**Error:** `"Base URL must start with http:// or https://"`
- **Solution:** Fix the base URL format

### Agent Stops Immediately

- **Check:** Node.js version (`node --version`)
- **Check:** API key validity with provider
- **Check:** Terminal logs for error messages

---

## Technical Details

### Process Execution

When you click "Start Agent", the following command is executed:

```bash
npx @ui-tars/cli@latest start \
  --provider anthropic \
  --model claude-3-7-sonnet-latest \
  --apiKey sk-... \
  --baseUrl https://api.anthropic.com/v1 \
  --headless
```

### Process Management

- **Parent:** ArkAngel Tauri backend (Rust)
- **Child:** Node.js process running UI-TARS CLI
- **Lifecycle:** Managed via `agent_manager::AgentState`
- **Cleanup:** Agent stopped when ArkAngel quits

### Permissions API (macOS)

The backend checks for:
- `CGPreflightScreenCaptureAccess()` - Screen Recording
- Accessibility API access - Mouse/keyboard control

---

## Next Steps

### Potential Enhancements

1. **Agent Chat Interface**
   - Add a dedicated chat window for agent instructions
   - Real-time feedback from agent actions
   - Step-by-step execution preview

2. **Guardrails & Safety**
   - Action allowlist (block destructive commands)
   - Confirmation prompts for risky operations
   - Session replay & logs

3. **Multi-Agent Support**
   - Run multiple agents for different tasks
   - Agent orchestration and delegation
   - Specialized agents (browser, desktop, CLI)

4. **Integration with ArkAngel Chat**
   - Send instructions from main chat to agent
   - Receive agent results in conversation
   - Hybrid human-agent workflows

---

## Resources

- **UI-TARS Desktop:** https://github.com/bytedance/UI-TARS-desktop
- **Agent TARS:** https://agent-tars.com
- **Claude API:** https://docs.anthropic.com
- **OpenAI API:** https://platform.openai.com/docs

---

## License & Disclaimer

This integration uses **UI-TARS Desktop** (MIT License) and **Agent TARS** from ByteDance.

⚠️ **Disclaimer:** The agent has full control of your computer when running. Use at your own risk. ArkAngel and UI-TARS developers are not responsible for any damage caused by agent actions.

---

## Credits

- **UI-TARS Desktop:** ByteDance
- **ArkAngel:** Nadav Shanun
- **Integration:** Claude Code Assistant

---

**Status:** ✅ Ready to use! Open Advanced Settings > Agent to get started.
