# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ArkAngel is a privacy-first, desktop AI assistant built with Tauri 2, React 19, and Rust. It provides real-time AI conversations during meetings and interviews with automatic PII/PHI redaction, multi-provider support (OpenAI, Claude, Gemini, Grok), and cloud storage integration via AWS S3.

## Build & Development Commands

### Development
```bash
# Start Vite dev server only (frontend hot-reload)
npm run dev

# Start full Tauri development environment (includes Rust backend)
npm run tauri dev

# Build sidecar manually (usually auto-built by Tauri)
cd sidecar && npm run build
```

### Production Build
```bash
# Build frontend assets
npm run build

# Build complete Tauri application for distribution
npm run tauri build
```

### Testing
```bash
# No formal test suite currently configured
# Manual testing via tauri dev recommended
```

## Architecture Overview

### Three-Layer Architecture

1. **Frontend (React/TypeScript)**: UI components in `src/`, built with Vite, runs on port 1420 during development
2. **Backend (Rust/Tauri)**: Desktop framework in `src-tauri/`, provides IPC commands for file operations, PII scrubbing, AWS uploads, window management
3. **Sidecar (Node.js/Express)**: AI agent orchestration in `sidecar/`, runs on port 8765, handles MCP tool calling and Google Workspace integration

### Key Data Flow

```
User Input → React UI (useCompletion hook)
    ↓
Format messages (lib/completion.ts)
    ↓
Stream to AI Provider API (lib/api.ts)
    ↓
Render response (React Markdown)
    ↓
Auto-export to memory/ folder (every 60s)
    ↓
PII scrubbing via Rust (pii_scrubber.rs)
    ↓
Optional AWS S3 upload (aws_uploader.rs)
```

## Critical Files & Components

### Frontend Core

- **`src/hooks/useCompletion.ts`** (880+ lines): Main chat logic, message streaming, file handling, provider switching
- **`src/lib/api.ts`**: Streaming API client with SSE parsing, model fetching
- **`src/lib/completion.ts`**: Message formatting for different AI providers (OpenAI, Claude, Gemini, Grok)
- **`src/lib/storage.ts`**: LocalStorage persistence, conversation export to JSON
- **`src/config/constants.ts`**: Provider definitions (base URLs, auth types, model lists)
- **`src/types/completion.ts`**: Core type definitions (ChatConversation, ChatMessage, AttachedFile)

### Backend Core (Rust)

- **`src-tauri/src/lib.rs`** (420 lines): Tauri command handlers (IPC layer between React and Rust)
- **`src-tauri/src/file_storage.rs`** (691 lines): File upload system with UUID tracking, text extraction (PDF, code), metadata indexing
- **`src-tauri/src/pii_scrubber.rs`** (332 lines): Regex-based PII/PHI detection (SSN, credit cards, emails, medical records, IP addresses)
- **`src-tauri/src/aws_uploader.rs`**: Background S3 uploader with retry logic, presigned URL workflow
- **`src-tauri/src/window.rs`**: Window positioning and visibility management

### Sidecar (Node.js)

- **`sidecar/src/smart-mcp-agent.ts`**: AI agent with tool calling via Model Context Protocol
- **`sidecar/src/server.ts`**: Express server exposing chat endpoint
- **`sidecar/src/google-workspace-mcp.ts`**: Google Calendar and Gmail integration

## Provider System

ArkAngel supports multiple AI providers through a generic abstraction. Each provider in `src/config/constants.ts` defines:

- **baseUrl**: API endpoint
- **authType**: `"bearer"`, `"x-api-key"`, or custom header
- **requestFormat**: JSON path to messages array (e.g., `"messages"`)
- **responseFormat**: JSON path to content (e.g., `"choices[0].message.content"`)
- **streamChunkPath**: Path for SSE chunks (e.g., `"choices[0].delta.content"`)
- **supportsModelFetch**: Whether to dynamically fetch available models
- **supportsImages**: Whether provider accepts image inputs

### Adding a New Provider

1. Add provider definition to `PROVIDER_INFO` in `src/config/constants.ts`
2. Implement message formatting in `src/lib/completion.ts` (`formatMessageForProvider`)
3. Handle streaming response format in `src/lib/api.ts` (`streamCompletion`)
4. Add model list or fetch logic if needed

## File Upload System

Files are stored in `uploads/` with UUID-based naming:

1. User uploads file via `file_storage.rs::upload_file`
2. Rust extracts text content (PDF via `pdf-extract`, code/txt via fs)
3. Metadata saved to `uploads/index.json` with UUID, original name, size, timestamp
4. Frontend toggles context inclusion via `file_storage.rs::toggle_file_context`
5. Active files included in LLM messages via `useCompletion` hook

**Supported file types**: PDF, TXT, JS, TS, RS, PY, GO, JAVA, CPP, C, H, JSON, XML, HTML, CSS, MD, YML, YAML

## PII/PHI Scrubbing

All conversations are automatically scrubbed before export/upload via `pii_scrubber.rs`. Patterns detected:

- SSN (XXX-XX-XXXX)
- Credit cards (16 digits with optional spaces/dashes)
- Bank account numbers
- Phone numbers (US format)
- Email addresses
- Street addresses
- Medical record numbers
- Driver's license numbers
- Passport numbers
- IP addresses
- Bitcoin wallet addresses

Redaction format: `[REDACTED_SSN]`, `[REDACTED_EMAIL]`, etc.

## Memory & Storage

### LocalStorage Keys (browser storage)
- `chat-conversations`: All chat history
- `conversation-metadata`: Conversation titles and timestamps
- `custom-providers`: User-defined AI providers
- `personas`: System prompt templates
- Settings keys: `openai-api-key`, `anthropic-api-key`, `gemini-api-key`, `grok-api-key`, `selected-provider`, `selected-model`, etc.

### File System
- **`memory/`**: Exported conversations as JSON files (auto-exported every 60s)
  - Format: `conversation_<uuid>.json` → `conversation_<uuid>.json.synced` (after S3 upload)
- **`uploads/`**: Uploaded files with `index.json` metadata
- **`transcripts/`**: Meeting transcript storage

## Tauri IPC Commands

Frontend invokes Rust functions via `@tauri-apps/api/core`:

```typescript
import { invoke } from '@tauri-apps/api/core';

// File operations
await invoke('upload_file', { filePath: '...' })
await invoke('get_uploaded_files')
await invoke('toggle_file_context', { fileId: 'uuid' })
await invoke('delete_file', { fileId: 'uuid' })

// PII scrubbing
await invoke('scrub_pii', { text: '...' })

// AWS upload
await invoke('trigger_aws_upload')

// Window management
await invoke('resize_window', { height: 600 })
```

## AWS S3 Integration

Configuration in `src-tauri/config.toml`:

```toml
api_url = "https://<api-gateway-url>/ingest/new"
device_id = "unique-device-id"
watch_dir = "./memory"  # or ".\\memory" on Windows
scan_interval_secs = 60
concurrency = 2
```

Workflow:
1. Background uploader scans `memory/` every 60 seconds
2. Finds `.json` files (ignores `.tmp`, `.synced`)
3. Calls presigner API to get S3 presigned PUT URL
4. Uploads file content
5. Renames to `.json.synced` on success
6. Retries with exponential backoff on failure

## Window Management

ArkAngel uses a minimal, always-on-top window:
- Default: 700x54px collapsed state
- Expands to ~600-800px height when chat is active
- macOS private API enabled for advanced window control
- Transparent background with custom decorations

## Common Pitfalls

1. **Sidecar not building**: Ensure Node.js dependencies are installed in `sidecar/` before running `tauri dev`
2. **Port conflicts**: Vite uses port 1420, sidecar uses 8765 - ensure both are available
3. **PII scrubbing edge cases**: Regex patterns may over-redact; test with sample data before production
4. **Provider auth format**: Different providers use different auth headers (Bearer vs x-api-key vs custom)
5. **File path separators**: Use forward slashes in config for cross-platform compatibility, except Windows-specific cases
6. **LocalStorage limits**: Browser has 5-10MB limit; large conversation histories should be pruned periodically
7. **Tauri IPC serialization**: All data passed between React and Rust must be JSON-serializable

## Important Implementation Notes

- **Streaming responses**: All providers use Server-Sent Events (SSE) format, parsed in `api.ts`
- **Message roles**: Providers expect different role names (e.g., OpenAI uses `"system"/"user"/"assistant"`, Claude uses similar but with different content format)
- **Image handling**: Images are base64-encoded and embedded in message content per provider format
- **Custom providers**: Users can add unlimited custom providers via settings UI, stored in LocalStorage
- **Auto-export**: Conversations export to `memory/` folder every 60 seconds to prevent data loss

## Environment Variables

Create `.env.local` (not committed to git):

```env
# Optional: Supabase integration
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...

# API keys managed via UI settings (stored in LocalStorage)
```

## Dependency Management

### Frontend
- React 19 with strict TypeScript (tsconfig.json has `"strict": true`)
- Tailwind CSS 4 via Vite plugin
- Radix UI for accessible components
- Path alias `@/` resolves to `src/`

### Backend
- Tauri 2 with Cargo.toml dependencies
- Key crates: serde, regex, reqwest, uuid, chrono, pdf-extract

### Sidecar
- Separate package.json in `sidecar/`
- LangChain for LLM orchestration
- MCP (Model Context Protocol) via `mcp-use`

## Debugging

- **Frontend logs**: Browser DevTools console (Cmd+Option+I on macOS)
- **Rust logs**: Terminal running `tauri dev` shows Rust println! output
- **Sidecar logs**: Check sidecar stdout/stderr in Tauri console
- **Network requests**: Use DevTools Network tab to inspect API calls

## Code Style

- TypeScript: Use strict mode, explicit types preferred over inference for public APIs
- Rust: Follow Rust conventions (snake_case for functions/variables, PascalCase for types)
- React: Functional components with hooks, avoid class components
- File organization: Group by feature (components/completion/, components/settings/) rather than type
