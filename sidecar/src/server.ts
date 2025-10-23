import express from 'express'
import cors from 'cors'
import { ChatOpenAI } from '@langchain/openai'
import { MCPAgent, MCPClient } from 'mcp-use'
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { logFeatureFlags } from './feature-flags.js'

const app = express()
const port = Number(process.env.AGENT_PORT || process.env.PORT || 8765)

// Middleware
app.use(cors())
app.use(express.json())

// Simple request logger
app.use((req, _res, next) => {
  console.log(`[sidecar] ${new Date().toISOString()} ${req.method} ${req.url}`)
  next()
})

// Initialize MCP client (shared)
const config = {
  mcpServers: {
    google_workspace: {
      command: "uvx",
      args: [
        "workspace-mcp",
        "--tools",
        "gmail",
        "drive",
        "calendar",
       // "docs",
        "sheets",
        "chat",
        "forms",
        "slides",
        "tasks",
        "search"
      ]
    }
  }
} as const

const client = MCPClient.fromDict(config as any)

function stringifyPreview(value: unknown, maxLen: number = 300): string {
  try {
    const asString = typeof value === 'string' ? value : JSON.stringify(value)
    if (!asString) return ''
    return asString.length > maxLen ? asString.slice(0, maxLen) + '…' : asString
  } catch {
    return '[unserializable]'
  }
}

function getCredentialStoreDir(): string {
  const envDir = process.env.GOOGLE_MCP_CREDENTIALS_DIR
  if (envDir?.trim()) return envDir
  const home = process.env.HOME || process.env.USERPROFILE || ''
  if (home) return path.join(home, '.google_workspace_mcp', 'credentials')
  return path.join(process.cwd(), '.credentials')
}

function readFirstCredentialEmail(): string | null {
  try {
    const dir = getCredentialStoreDir()
    if (!fs.existsSync(dir)) return null
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
    if (files.length === 0) return null
    // If there are multiple, prefer a file that looks like an email filename
    const emailLike = files.find(f => f.includes('@')) || files[0]
    const email = emailLike.replace(/\.json$/i, '')
    return email
  } catch {
    return null
  }
}

function readScopesForEmail(email: string): string[] {
  try {
    const dir = getCredentialStoreDir()
    const p = path.join(dir, `${email}.json`)
    if (!fs.existsSync(p)) return []
    const raw = fs.readFileSync(p, 'utf-8')
    const json = JSON.parse(raw)
    const scopes = Array.isArray(json?.scopes) ? json.scopes : []
    return scopes.filter((s: unknown) => typeof s === 'string')
  } catch {
    return []
  }
}

// ---------------- Conversation memory & background summarization ----------------

type Role = 'user' | 'assistant'

type ConversationTurn = {
  role: Role
  content: string
  timestamp: string
}

// ---------------- Design Sync (SSE + POST) ----------------
type DesignState = { accent: 'bw' | 'rainbow'; gradient: 'bw' | 'rainbow'; theme: 'light' | 'dark' | 'system' }
let designState: DesignState = { accent: 'bw', gradient: 'bw', theme: 'system' }

type SSEClient = { id: number; res: any }
const sseClients = new Map<number, SSEClient>()
let nextClientId = 1

function sendSSEEvent(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const { res } of sseClients.values()) {
    try { res.write(payload) } catch {}
  }
}

app.get('/design/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const id = nextClientId++
  sseClients.set(id, { id, res })

  // Send current state immediately
  sendSSEEvent({ type: 'state', accent: designState.accent, gradient: designState.gradient, theme: designState.theme })

  req.on('close', () => {
    sseClients.delete(id)
  })
})

app.post('/design', (req, res) => {
  try {
    const { accent, gradient, theme } = req.body || {}
    let changed = false
    if (accent === 'bw' || accent === 'rainbow') {
      designState.accent = accent
      changed = true
    }
    if (gradient === 'bw' || gradient === 'rainbow') {
      designState.gradient = gradient
      changed = true
    }
    if (theme === 'light' || theme === 'dark' || theme === 'system') {
      designState.theme = theme
      changed = true
    }
    if (changed) {
      sendSSEEvent({ type: 'update', accent: designState.accent, gradient: designState.gradient, theme: designState.theme })
    }
    res.json({ ok: true, state: designState })
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) })
  }
})

// Simple ping for design sync connectivity
app.get('/design/ping', (_req, res) => {
  res.json({ ok: true, state: designState, timestamp: new Date().toISOString() })
})

type ConversationState = {
  turns: ConversationTurn[]
  summary: string
  summarizing: boolean
  lastSummaryAt?: number
}

const conversations = new Map<string, ConversationState>()

function resolveChatId(req: any): string {
  const header = req.header?.('x-chat-id')
  const { chatId, conversationId } = (req.body || {}) as { chatId?: string; conversationId?: string }
  return String(header || chatId || conversationId || 'default')
}

function getConversationState(chatId: string): ConversationState {
  let state = conversations.get(chatId)
  if (!state) {
    state = { turns: [], summary: '', summarizing: false, lastSummaryAt: undefined }
    conversations.set(chatId, state)
  }
  return state
}

function addTurn(chatId: string, role: Role, content: string) {
  const state = getConversationState(chatId)
  state.turns.push({ role, content, timestamp: new Date().toISOString() })
}

function formatTurn(turn: ConversationTurn): string {
  const who = turn.role === 'user' ? 'User' : 'Assistant'
  return `${who}: ${turn.content}`
}

function buildConversationContext(state: ConversationState, maxRecent: number = 6): string {
  const turns = state.turns
  if (!turns.length && !state.summary) return ''

  const recent = turns.slice(Math.max(0, turns.length - maxRecent))
  const olderCount = Math.max(0, turns.length - recent.length)

  const blocks: string[] = []
  if (state.summary) {
    blocks.push(`Conversation Summary (compressed from ${olderCount} earlier message${olderCount === 1 ? '' : 's'}):\n${state.summary}`)
  }
  if (recent.length) {
    blocks.push(`Recent Messages (up to last ${maxRecent}):\n${recent.map(formatTurn).join('\n')}`)
  }
  return blocks.join('\n\n')
}

async function maybeSummarizeAsync(chatId: string, apiKey: string | undefined, model: string | undefined) {
  const state = getConversationState(chatId)
  const maxRecent = 6
  const olderTurns = state.turns.slice(0, Math.max(0, state.turns.length - maxRecent))

  // Nothing to summarize or already running
  if (olderTurns.length === 0 || state.summarizing) return

  // Mark as running
  state.summarizing = true

  // Prefer a small, cheap model for summarization if none provided
  const summaryModel = model || 'gpt-4o-mini'

  try {
    const llm = new ChatOpenAI({ model: summaryModel, temperature: 0.2, apiKey })

    const existing = state.summary || 'None'
    const olderText = olderTurns.map(formatTurn).join('\n')

    const prompt = [
      'You maintain a running, concise summary of a chat between a user and an AI assistant.',
      'Update the summary with the following earlier messages so that only the key facts, decisions, tasks, entities, and user preferences remain.',
      'Keep it objective, 180-250 words, no salutations or meta commentary.',
      '',
      `Existing summary:\n${existing}`,
      '',
      'Earlier messages to compress:',
      olderText,
      '',
      'Return only the updated summary.'
    ].join('\n')

    const aiMsg: any = await llm.invoke(prompt as any)
    let summaryText = ''
    if (typeof aiMsg?.content === 'string') {
      summaryText = aiMsg.content
    } else if (Array.isArray(aiMsg?.content)) {
      summaryText = aiMsg.content.map((c: any) => (typeof c === 'string' ? c : c?.text ?? '')).join('')
    } else if (aiMsg?.text) {
      summaryText = aiMsg.text
    }

    // Update state: set new summary, keep only the last maxRecent turns
    state.summary = summaryText?.trim() || state.summary
    const recent = state.turns.slice(Math.max(0, state.turns.length - maxRecent))
    state.turns = recent
    state.lastSummaryAt = Date.now()
  } catch (err) {
    console.error('[sidecar] Background summary error:', err)
  } finally {
    const s = getConversationState(chatId)
    s.summarizing = false
  }
}

function enhanceSystemPromptWithDateTime(systemPrompt?: string): string {
  const now = new Date()
  const resolvedEmail = readFirstCredentialEmail() || 'unknown'
  const scopes = resolvedEmail !== 'unknown' ? readScopesForEmail(resolvedEmail) : []
  
  const dateTimeInfo = `CURRENT DATE & TIME CONTEXT:
- Current Date: ${now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}
- Current Time: ${now.toLocaleTimeString('en-US', { 
    hour12: true, 
    hour: 'numeric', 
    minute: '2-digit', 
    second: '2-digit',
    timeZoneName: 'short'
  })}
- Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
- ISO Timestamp: ${now.toISOString()}
- User Google Email: ${resolvedEmail}
- Enabled Google Scopes (${scopes.length}): ${scopes.join(', ')}

IMPORTANT: When working with calendar events, scheduling, or time-sensitive tasks, always consider this current date/time context. The user's computer timezone is ${Intl.DateTimeFormat().resolvedOptions().timeZone}, but calendar events may be in different timezones.

CONVERSATION & CONTEXT POLICY:
- This is a multi-turn conversation. You may receive a Conversation Context section (Summary + Recent Messages).
- The Recent Messages section has priority over the Summary if there is any conflict.
- Always answer the most recent User message first. Use prior context to inform and maintain continuity.
- When the user says "that", "those", "it", "the above", "continue", or similar, resolve references from the latest tool results or messages in Recent Messages. Reuse already-presented data (e.g., calendar events, emails) instead of re-fetching unless explicitly asked.
- Preserve entities, constraints, decisions, and user preferences across turns.
- If context is ambiguous, ask one concise clarifying question while offering your best interpretation.
- Prefer concise summaries over re-listing long content unless the user asks to see the full list again.

${systemPrompt || 'You are a helpful AI assistant with access to calendar, email, and other productivity tools.'}`

  return dateTimeInfo.trim()
}

function createAgent(opts: { providerId?: string; model?: string; apiKey?: string; systemPrompt?: string }) {
  const provider = (opts.providerId || 'openai').toLowerCase()
  const model = opts.model || 'gpt-4o-mini'
  const apiKey = opts.apiKey || process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing. Provide it in request body or environment.')
  }

  if (provider !== 'openai') {
    console.warn('[sidecar] Only OpenAI is wired here; using ChatOpenAI with provided key.')
  }
  const llm = new ChatOpenAI({ model, temperature: 0.5, streaming: true, apiKey })
  
  // Add a single local file tool to fetch content by id
  const uploadsDir = path.resolve(process.cwd(), '..', 'uploads')
  const indexPath = path.join(uploadsDir, 'index.json')
  function readIndex(): any[] {
    try {
      if (!fs.existsSync(indexPath)) return []
      const raw = fs.readFileSync(indexPath, 'utf-8')
      return JSON.parse(raw) || []
    } catch {
      return []
    }
  }

  const localTools: any[] = [
    {
      name: 'arkangel_read_file',
      description: 'Read extracted text content of an uploaded file by id. Use only when needed.',
      input_schema: {
        type: 'object',
        properties: { fileId: { type: 'string' }, offset: { type: 'number', default: 0 }, limit: { type: 'number', default: 5000 } },
        required: ['fileId']
      },
      handler: async ({ fileId, offset = 0, limit = 5000 }: any) => {
        const files = readIndex()
        const f = files.find((x: any) => x?.id === fileId)
        if (!f) return `Error: file not found: ${fileId}`
        const content = String(f.content || '')
        const start = Math.max(0, Number(offset) || 0)
        const len = Math.max(1, Math.min(Number(limit) || 5000, 100_000))
        const slice = content.slice(start, start + len)
        console.log(`[sidecar] arkangel_read_file: id=${fileId} offset=${start} length=${slice.length}`)
        return `File: ${f.name} (${f.file_type}, ${f.size} bytes)\nOffset: ${start}, Length: ${slice.length}\n\n${slice}`
      }
    }
  ]

  const agent = new MCPAgent({
    llm: llm as any,
    client,
    maxSteps: 20,
    disallowedTools: ["shell", "file_system", "network"],
    tools: localTools as any
  } as any)
  return { agent, systemPrompt: opts.systemPrompt }
}

class StreamingMCPAgent {
  private readonly agent: MCPAgent
  private readonly streamCallback: (event: any) => void
  private readonly toolStartTimes: Map<string, number[]>

  constructor(agent: MCPAgent, streamCallback: (event: any) => void) {
    this.agent = agent
    this.streamCallback = streamCallback
    this.toolStartTimes = new Map()
  }

  async run(message: string): Promise<string> {
    try {
      const eventStream = this.agent.streamEvents(message)
      let finalText = ''
      let responseStarted = false
      let llmStarted = false
      let llmChars = 0

      for await (const event of eventStream as any) {
        switch (event.event) {
          case 'on_chat_model_start': {
            const inputPreview = stringifyPreview(event.data?.input ?? event.data?.messages)
            console.log('[sidecar] [LLM START]', {
              at: new Date().toISOString(),
              inputPreview
            })
            break
          }
          case 'on_tool_start': {
            const toolName = event.name || event.data?.name || 'unknown_tool'
            const now = Date.now()
            const starts = this.toolStartTimes.get(toolName) || []
            starts.push(now)
            this.toolStartTimes.set(toolName, starts)

            const inputPreview = stringifyPreview(event.data?.input ?? event.data?.inputs)
            console.log(`[sidecar] [MCP TOOL START] ${toolName}`, {
              at: new Date(now).toISOString(),
              inputPreview,
              promptPreview: stringifyPreview(message)
            })
            this.streamCallback({
              type: 'tool_start',
              content: `🔧 ${toolName} started`,
              tool: toolName,
              input: event.data?.input ?? event.data?.inputs ?? null,
              timestamp: new Date().toISOString()
            })
            break
          }
          case 'on_tool_end': {
            const toolName = event.name || event.data?.name || 'unknown_tool'
            const now = Date.now()
            const starts = this.toolStartTimes.get(toolName) || []
            const startedAt = starts.pop()
            if (startedAt !== undefined) this.toolStartTimes.set(toolName, starts)
            const durationMs = startedAt !== undefined ? now - startedAt : undefined

            const outputPreview = stringifyPreview(
              event.data?.output ?? event.data?.result ?? event.data?.observation
            )
            console.log(`[sidecar] [MCP TOOL END] ${toolName}`, {
              at: new Date(now).toISOString(),
              durationMs,
              outputPreview
            })
            this.streamCallback({
              type: 'tool_end',
              content: `✅ ${toolName} completed`,
              tool: toolName,
              output: event.data?.output ?? event.data?.result ?? event.data?.observation ?? null,
              timestamp: new Date().toISOString()
            })
            break
          }
          case 'on_chat_model_stream':
          case 'on_llm_stream': {
            const chunk = event.data?.chunk
            let token = ''
            if (typeof chunk?.content === 'string') {
              token = chunk.content
            } else if (Array.isArray(chunk?.content)) {
              token = chunk.content.map((c: any) => (typeof c === 'string' ? c : c?.text ?? '')).join('')
            } else if (typeof chunk?.text === 'string') {
              token = chunk.text
            }
            if (token) {
              if (!responseStarted) {
                this.streamCallback({
                  type: 'response_start',
                  content: 'Response:',
                  timestamp: new Date().toISOString()
                })
                responseStarted = true
              }
              if (!llmStarted) {
                console.log('[sidecar] [LLM STREAM]', { at: new Date().toISOString() })
                llmStarted = true
              }
              finalText += token
              llmChars += token.length
              try { process.stdout.write(token) } catch {}
              this.streamCallback({
                type: 'token',
                content: token,
                timestamp: new Date().toISOString()
              })
            }
            break
          }
        }
      }

      if (llmStarted) {
        try { process.stdout.write('\n') } catch {}
        console.log('[sidecar] [LLM COMPLETE]', { at: new Date().toISOString(), totalChars: llmChars })
      }
      return finalText.trim()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isGoogleCalendarOAuthError =
        message.includes('OAuth credentials not found') ||
        message.includes('Error loading OAuth keys') ||
        message.includes('google-calendar-mcp')

      if (isGoogleCalendarOAuthError) {
        this.streamCallback({
          type: 'oauth_required',
          provider: 'google_calendar',
          content: 'Google Calendar OAuth is required to use this tool.',
          authUrl: 'https://console.cloud.google.com/apis/credentials',
          timestamp: new Date().toISOString()
        })
      }

      this.streamCallback({
        type: 'error',
        content: 'Error during processing',
        error: message,
        timestamp: new Date().toISOString()
      })
      console.error('[sidecar] Agent error:', message)
      throw error
    }
  }
}

// Streaming chat endpoint
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message, apiKey, model, providerId, systemPrompt, fileSummaries } = req.body || {}

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Derive effective key (body -> header -> env)
    const headerKey = req.header('x-openai-key')
    const effectiveKey = apiKey || headerKey || process.env.OPENAI_API_KEY
    const masked = effectiveKey ? `${String(effectiveKey).slice(0, 3)}***` : 'none'
    console.log('[sidecar] Using API key:', masked)

    const chatId = resolveChatId(req)
    const state = getConversationState(chatId)

    console.log('[sidecar] Processing streaming message:', stringifyPreview(message))

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no'
    })

    ;(res as any).flushHeaders?.()

    res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`)

    try {
      console.log('[sidecar] MCP always enabled for all requests')
      
      const { agent, systemPrompt: derivedSystemPrompt } = createAgent({ 
        apiKey: effectiveKey, 
        model, 
        providerId, 
        systemPrompt 
      })
      
      // Build conversation context BEFORE adding the new user turn to avoid duplication
      const conversationContext = buildConversationContext(state, 6)

      // Use MCP agent with streaming for all requests
      const streamingAgent = new StreamingMCPAgent(agent, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      })
      
      // Add summaries if available and conversation context
      let enhancedSystemPrompt = enhanceSystemPromptWithDateTime(derivedSystemPrompt)
      if (conversationContext) {
        enhancedSystemPrompt = `${enhancedSystemPrompt}\n\nConversation Context:\n\n${conversationContext}`
      }
      if (Array.isArray(fileSummaries) && fileSummaries.length > 0) {
        const joined = String(fileSummaries.join('\n- '))
        console.log('[sidecar] File summaries included in prompt:\n- ' + joined)
        enhancedSystemPrompt = `${enhancedSystemPrompt}\n\nUploaded Files (summaries only):\n- ${joined}`
      }
      
      // Record the new user turn and kick off background summarization (non-blocking)
      addTurn(chatId, 'user', String(message))
      // Fire-and-forget summary update so it does not slow the main generation
      void maybeSummarizeAsync(chatId, effectiveKey, model)
      
      const finalMessage = `${enhancedSystemPrompt}\n\n${message}`
      const responseText = await streamingAgent.run(finalMessage)

      // Persist assistant response
      addTurn(chatId, 'assistant', responseText)

      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        timestamp: new Date().toISOString()
      })}\n\n`)

    } catch (error) {
      console.error('[sidecar] Streaming error:', error)
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        content: 'Sorry, I encountered an error while processing your request.',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`)
    res.end()

  } catch (error) {
    console.error('[sidecar] Stream setup error:', error)
    res.status(500).json({ 
      error: 'Failed to setup streaming',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Non-streaming chat endpoint (fallback)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, apiKey, model, providerId, systemPrompt, fileSummaries } = req.body || {}

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const headerKey = req.header('x-openai-key')
    const effectiveKey = apiKey || headerKey || process.env.OPENAI_API_KEY
    const masked = effectiveKey ? `${String(effectiveKey).slice(0, 3)}***` : 'none'
    console.log('[sidecar] Using API key:', masked)

    const chatId = resolveChatId(req)
    const state = getConversationState(chatId)

    console.log('[sidecar] Processing message:', stringifyPreview(message))

    const { agent, systemPrompt: derivedSystemPrompt } = createAgent({ apiKey: effectiveKey, model, providerId, systemPrompt })
    
    // Build conversation context BEFORE adding the new user turn to avoid duplication
    const conversationContext = buildConversationContext(state, 6)

    // Add summaries if available and conversation context
    let enhancedSystemPrompt = enhanceSystemPromptWithDateTime(derivedSystemPrompt)
    if (conversationContext) {
      enhancedSystemPrompt = `${enhancedSystemPrompt}\n\nConversation Context:\n\n${conversationContext}`
    }
    if (Array.isArray(fileSummaries) && fileSummaries.length > 0) {
      const joined = String(fileSummaries.join('\n- '))
      enhancedSystemPrompt = `${enhancedSystemPrompt}\n\nUploaded Files (summaries only):\n- ${joined}\n\nYou have tools: arkangel_list_files, arkangel_read_file. Use them to inspect files on demand instead of relying on summaries.`
    }
    
    // Record user turn and kick off background summarization (non-blocking)
    addTurn(chatId, 'user', String(message))
    void maybeSummarizeAsync(chatId, effectiveKey, model)
    
    const finalMessage = `${enhancedSystemPrompt}\n\n${message}`
    const result = await agent.run(finalMessage)

    // Persist assistant response
    addTurn(chatId, 'assistant', String(result))

    res.json({ 
      success: true, 
      response: result,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[sidecar] Chat error:', error)
    const msg = error instanceof Error ? error.message : String(error)

    res.status(500).json({ 
      error: 'Failed to process message',
      details: msg
    })
  }
})

// Health check endpoint
app.get('/api/health', (_req, res) => {
  console.log('[sidecar] Health check')
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Get available MCP tools
app.get('/api/tools', async (_req, res) => {
  try {
    res.json({
      tools: [
        { name: 'arkangel_read_file', description: 'Read extracted text content of an uploaded file by id' }
      ]
    })
  } catch (error) {
    console.error('[sidecar] Tools error:', error)
    res.status(500).json({ error: 'Failed to get tools' })
  }
})

// ============================================================================
// COMPOSIO INTEGRATION ENDPOINTS
// ============================================================================

import { SmartComposioAgent } from './smart-composio-agent.js';
import { getIntegrationManager } from './integration-manager.js';
import { isComposioConfigured, healthCheck as composioHealthCheck } from './composio-client.js';

const integrationManager = getIntegrationManager();

/**
 * POST /api/chat/composio/stream - Streaming chat with Composio tool integration
 * This endpoint uses intelligent tool selection based on user's connected tools
 */
app.post('/api/chat/composio/stream', async (req, res) => {
  const { message, apiKey, model, providerId, userId, systemPrompt, fileContext } = req.body;

  // Validate required fields
  if (!message || !apiKey || !userId) {
    return res.status(400).json({ error: 'Missing required fields: message, apiKey, userId' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  console.log(`[Composio Chat] User: ${userId}, Model: ${model || 'gpt-4o-mini'}`);

  try {
    // Create smart agent
    const agent = new SmartComposioAgent({
      apiKey,
      model: model || 'gpt-4o-mini',
      providerId: providerId || 'openai',
      systemPrompt,
      userId,
      temperature: 0,
      maxIterations: 10
    });

    // Process query with intelligent tool selection
    const stream = agent.processQuery(message, [], fileContext);

    res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);

      // Handle errors and stop streaming
      if (chunk.type === 'error' || chunk.type === 'done') {
        break;
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error: any) {
    console.error('[Composio Chat Error]', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message || 'Agent execution failed'
    })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/integrations/connect - Initiate OAuth flow for a tool
 */
app.post('/api/integrations/connect', async (req, res) => {
  const { tool, userId, redirectUri } = req.body;

  if (!tool || !userId) {
    return res.status(400).json({ error: 'Missing required fields: tool, userId' });
  }

  if (!isComposioConfigured()) {
    return res.status(503).json({ error: 'Composio is not configured. Please set COMPOSIO_API_KEY.' });
  }

  try {
    console.log(`[Integrations] Connecting ${tool} for user: ${userId}`);
    const result = await integrationManager.connectTool(tool, userId, redirectUri);
    res.json(result);
  } catch (error: any) {
    console.error('[Integrations] Connect error:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate connection' });
  }
});

/**
 * POST /api/integrations/disconnect - Disconnect a tool
 */
app.post('/api/integrations/disconnect', async (req, res) => {
  const { tool, userId } = req.body;

  if (!tool || !userId) {
    return res.status(400).json({ error: 'Missing required fields: tool, userId' });
  }

  try {
    console.log(`[Integrations] Disconnecting ${tool} for user: ${userId}`);
    await integrationManager.disconnectTool(tool, userId);
    res.json({ success: true, message: `Disconnected ${tool}` });
  } catch (error: any) {
    console.error('[Integrations] Disconnect error:', error);
    res.status(500).json({ error: error.message || 'Failed to disconnect' });
  }
});

/**
 * GET /api/integrations/:userId - Get user's connected integrations
 */
app.get('/api/integrations/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const tools = await integrationManager.getUserTools(userId);
    res.json({ tools, count: tools.length });
  } catch (error: any) {
    console.error('[Integrations] Get tools error:', error);
    res.status(500).json({ error: error.message || 'Failed to get integrations' });
  }
});

/**
 * GET /api/integrations/:userId/status - Get status of all tools (connected + available)
 */
app.get('/api/integrations/:userId/status', async (req, res) => {
  const { userId } = req.params;

  try {
    const toolsStatus = await integrationManager.getAllToolsStatus(userId);
    res.json({ tools: toolsStatus, count: toolsStatus.length });
  } catch (error: any) {
    console.error('[Integrations] Get status error:', error);
    res.status(500).json({ error: error.message || 'Failed to get tool status' });
  }
});

/**
 * GET /api/oauth/callback - Handle OAuth callback from Composio
 */
app.get('/api/oauth/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Missing OAuth parameters');
  }

  try {
    await integrationManager.handleOAuthCallback(code as string, state as string);

    // Redirect to success page (this will be caught by Tauri)
    res.redirect('http://localhost:1420/settings?integration=success');
  } catch (error: any) {
    console.error('[OAuth] Callback error:', error);
    res.redirect('http://localhost:1420/settings?integration=error');
  }
});

/**
 * GET /api/composio/health - Check Composio configuration and connectivity
 */
app.get('/api/composio/health', async (_req, res) => {
  try {
    const isConfigured = isComposioConfigured();
    const isHealthy = isConfigured ? await composioHealthCheck() : false;

    res.json({
      configured: isConfigured,
      healthy: isHealthy,
      status: isHealthy ? 'ok' : (isConfigured ? 'unreachable' : 'not_configured'),
      message: isHealthy
        ? 'Composio is configured and accessible'
        : (isConfigured ? 'Composio API unreachable' : 'COMPOSIO_API_KEY not set')
    });
  } catch (error: any) {
    res.json({
      configured: false,
      healthy: false,
      status: 'error',
      message: error.message
    });
  }
});

// ============================================================================

app.listen(port, () => {
  console.log(`🚀 MCP Chat Server running on http://localhost:${port}`)
  console.log(`📡 API endpoints:`)
  console.log(`   POST /api/chat/stream - Send messages to MCP agent (streaming)`)
  console.log(`   POST /api/chat - Send messages to MCP agent (non-streaming)`)
  console.log(`   POST /api/chat/composio/stream - Composio intelligent tool chat (streaming)`)
  console.log(`   POST /api/integrations/connect - Initiate OAuth for tool`)
  console.log(`   POST /api/integrations/disconnect - Disconnect tool`)
  console.log(`   GET  /api/integrations/:userId - Get user's connected tools`)
  console.log(`   GET  /api/integrations/:userId/status - Get all tools status`)
  console.log(`   GET  /api/composio/health - Check Composio configuration`)
  console.log(`   GET  /api/health - Health check`)
  console.log(`   GET  /api/tools - List available MCP tools`)
  try {
    const servers = Object.keys((config as any).mcpServers || {})
    console.log(`🧩 MCP servers configured: ${servers.join(', ') || '(none)'}`)
  } catch {}

  // Log feature flags
  console.log('')
  logFeatureFlags()
  console.log('')
}) 