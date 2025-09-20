import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { SmartMCPAgent } from './smart-mcp-agent.js'
import { MCPServerManager } from './mcp-server-manager.js'
import { GoogleOAuthChecker } from './google-oauth-checker.js'
import { SettingsState } from './mcp-config.js'
import { ChatLogger } from './chat-logger.js'
import { TranscriptTimer } from './transcript-timer.js'
import { TranscriptAPI } from './transcript-api.js'

const app = express()
const port = Number(process.env.AGENT_PORT || process.env.PORT || 8765)

// Ensure credentials directory preference is set for status checks and spawns
if (!process.env.GOOGLE_MCP_CREDENTIALS_DIR) {
  const appData = process.env.APPDATA || process.env.HOME || process.cwd()
  const credsDir = `${String(appData).replace(/\\$/, '')}\\ArkAngel\\google_oauth\\credentials`
  process.env.GOOGLE_MCP_CREDENTIALS_DIR = credsDir
  console.log('[sidecar] GOOGLE_MCP_CREDENTIALS_DIR set to', credsDir)
}

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' })) // Increase limit to handle large file uploads

// Simple request logger
app.use((req, _res, next) => {
  console.log(`[sidecar] ${new Date().toISOString()} ${req.method} ${req.url}`)
  next()
})

// Initialize smart MCP agent
const smartAgent = new SmartMCPAgent()
const mcpManager = MCPServerManager.getInstance()
const googleOAuthChecker = GoogleOAuthChecker.getInstance()

// Initialize transcript system
const chatLogger = ChatLogger.getInstance()
const transcriptTimer = TranscriptTimer.getInstance()
const transcriptAPI = new TranscriptAPI()

// Utility functions
function stringifyPreview(value: unknown, maxLen: number = 300): string {
  try {
    const asString = typeof value === 'string' ? value : JSON.stringify(value)
    if (!asString) return ''
    return asString.length > maxLen ? asString.slice(0, maxLen) + '…' : asString
  } catch {
    return '[unserializable]'
  }
}

function enhanceSystemPromptWithDateTime(systemPrompt?: string): string {
  const now = new Date()
  
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

IMPORTANT: When working with calendar events, scheduling, or time-sensitive tasks, always consider this current date/time context. The user's computer timezone is ${Intl.DateTimeFormat().resolvedOptions().timeZone}, but calendar events may be in different timezones.

${systemPrompt || 'You are a helpful AI assistant with access to calendar, email, and other productivity tools.'}`

  return dateTimeInfo.trim()
}

// Streaming MCP Agent wrapper
class StreamingSmartAgent {
  private smartAgent: SmartMCPAgent
  private streamCallback: (event: any) => void

  constructor(smartAgent: SmartMCPAgent, streamCallback: (event: any) => void) {
    this.smartAgent = smartAgent
    this.streamCallback = streamCallback
  }

  async run(message: string, settings: SettingsState): Promise<string> {
    try {
      console.log(`[StreamingSmartAgent] Processing message: "${message.slice(0, 100)}..."`)
      
      // Add small delay to prevent rate limiting
      console.log(`[StreamingSmartAgent] Adding 2 second delay to prevent rate limiting...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      console.log(`[StreamingSmartAgent] Starting smart agent processing...`)
      
      // Use the smart agent to process the message
      const result = await this.smartAgent.run(message, settings)
      
      console.log(`[StreamingSmartAgent] Processing completed successfully`)

      // Simulate streaming by sending the complete response
          this.streamCallback({
            type: 'response_start',
            content: 'Response:',
            timestamp: new Date().toISOString()
          })
      
        this.streamCallback({
          type: 'token',
        content: result,
          timestamp: new Date().toISOString()
        })
      
      console.log('[sidecar] [LLM COMPLETE]', { at: new Date().toISOString(), totalChars: result.length })
      
      return result.trim()
    } catch (error) {
      console.error(`[StreamingSmartAgent] Error:`, error)
      
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[StreamingSmartAgent] Error message: "${message}"`)

      // Handle specific error types
      if (message.includes('OAuth credentials not found') || message.includes('Error loading OAuth keys')) {
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
app.post('/api/chat/stream', chatLogger.logChatRequest(), chatLogger.logChatResponse(), async (req, res) => {
  try {
    const { message, apiKey, model, providerId, systemPrompt, fileContext } = req.body || {}

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Get effective API key
    const headerKey = req.header('x-openai-key')
    const effectiveKey = apiKey || headerKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    
    if (!effectiveKey) {
      return res.status(400).json({ error: 'API key is required' })
    }

    const masked = effectiveKey ? `${String(effectiveKey).slice(0, 3)}***` : 'none'
    console.log('[sidecar] Using API key:', masked)
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
      // Check Google OAuth status
      const googleStatus = await googleOAuthChecker.checkStatus()

      // If explicitly in HTTP mode and server not up, ensure MCP server is running
      if ((process.env.GOOGLE_MCP_TRANSPORT || '').toLowerCase() === 'http') {
        if (googleStatus.connected && !mcpManager.isRunning()) {
          console.log('[sidecar] Starting workspace-mcp server (HTTP)…')
          await mcpManager.start()
        }
      } else {
        console.log('[sidecar] STDIO mode selected - no HTTP server startup in streaming path')
      }
      
      // Build settings object
      const settings: SettingsState = {
        selectedProvider: providerId || 'openai',
        apiKey: effectiveKey,
        openAiApiKey: providerId === 'openai' ? effectiveKey : '',
        claudeApiKey: providerId === 'claude' ? effectiveKey : '',
        selectedModel: model || 'gpt-4o-mini',
        customModel: model || '',
        systemPrompt: systemPrompt || '',
        // Use actual Google connection status, not just configuration check
        // workspace-mcp will handle token refresh automatically
        googleConnected: googleStatus.connected,
        googleOAuthClientId: googleOAuthChecker.getClientId() || undefined,
        googleOAuthClientSecret: googleOAuthChecker.getClientSecret() || undefined
      }

      console.log(`[sidecar] Settings: provider=${settings.selectedProvider}, googleConnected=${settings.googleConnected}`)

      // Initialize smart agent if needed
      await smartAgent.initialize(settings)
      
      const streamingAgent = new StreamingSmartAgent(smartAgent, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      })

      // Enhance system prompt with date/time context
      let enhancedSystemPrompt = enhanceSystemPromptWithDateTime(settings.systemPrompt)
      
      // Include file context from Rust backend if any
      if (fileContext && fileContext.length > 0) {
        console.log(`[sidecar] Processing ${fileContext.length} files from Rust backend`)
        const filesContext = fileContext.join('\n\n---\n\n')
        
        // Create a more explicit instruction for the AI to use the file context
        const fileContextInstruction = `\n\n=== DOCUMENTS AVAILABLE ===\nThe user has uploaded ${fileContext.length} document(s) that you MUST use to answer their questions. These documents contain the information you need:\n\n${filesContext}\n\n=== END OF DOCUMENTS ===\n\nCRITICAL INSTRUCTIONS:
1. You have access to the above documents - DO NOT say you don't have access
2. When the user asks about "docs", "documents", "what's in the doc", etc., refer to the content above
3. Use the document content to answer their questions
4. If they ask "what's in the doc", summarize the document content for them
5. The document content is real and available to you - use it!`
        
        // Add document context to the SYSTEM PROMPT, not the user message
        enhancedSystemPrompt = `${enhancedSystemPrompt}${fileContextInstruction}`
        console.log(`[sidecar] Enhanced system prompt with file context (${enhancedSystemPrompt.length} chars)`)
        console.log(`[sidecar] File context preview: ${filesContext.substring(0, 200)}...`)
        console.log(`[sidecar] User message: "${message}"`)
        console.log(`[sidecar] Document count: ${fileContext.length}`)
      }
      
      const finalMessage = `${enhancedSystemPrompt}\n\n${message}`
      
      await streamingAgent.run(finalMessage, settings)

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
app.post('/api/chat', chatLogger.logChatRequest(), chatLogger.logChatResponse(), async (req, res) => {
  try {
    const { message, apiKey, model, providerId, systemPrompt, fileContext } = req.body || {}

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const headerKey = req.header('x-openai-key')
    const effectiveKey = apiKey || headerKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    
    if (!effectiveKey) {
      return res.status(400).json({ error: 'API key is required' })
    }

    const masked = effectiveKey ? `${String(effectiveKey).slice(0, 3)}***` : 'none'
    console.log('[sidecar] Using API key:', masked)
    console.log('[sidecar] Processing message:', stringifyPreview(message))

    // Check Google OAuth status
    const googleStatus = await googleOAuthChecker.checkStatus()
    
    // Build settings object
    const settings: SettingsState = {
      selectedProvider: providerId || 'openai',
      apiKey: effectiveKey,
      openAiApiKey: providerId === 'openai' ? effectiveKey : '',
      claudeApiKey: providerId === 'claude' ? effectiveKey : '',
      selectedModel: model || 'gpt-4o-mini',
      customModel: model || '',
      systemPrompt: systemPrompt || '',
      googleConnected: googleStatus.connected,
      googleOAuthClientId: googleOAuthChecker.getClientId() || undefined,
      googleOAuthClientSecret: googleOAuthChecker.getClientSecret() || undefined
    }

    // Initialize smart agent if needed
    await smartAgent.initialize(settings)
    
    const enhancedSystemPrompt = enhanceSystemPromptWithDateTime(settings.systemPrompt)
    
    // Include file context from Rust backend if any
    let finalMessage = `${enhancedSystemPrompt}\n\n${message}`
    if (fileContext && fileContext.length > 0) {
      console.log(`[sidecar] Processing ${fileContext.length} files from Rust backend`)
      const filesContext = fileContext.join('\n\n---\n\n')
      finalMessage = `${enhancedSystemPrompt}\n\nFile Context:\n\n${filesContext}\n\n${message}`
      console.log(`[sidecar] Enhanced message with file context (${finalMessage.length} chars)`)
    }
    
    const result = await smartAgent.run(finalMessage, settings)

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

// Models endpoint
app.get('/api/models', async (req, res) => {
  try {
    const { provider = 'openai', apiKey } = req.query
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' })
    }

    console.log(`[sidecar] Fetching models for provider: ${provider}`)
    
    let url = ''
    let headers: Record<string, string> = {}
    
    if (provider === 'openai') {
      url = 'https://api.openai.com/v1/models'
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    } else if (provider === 'claude') {
      url = 'https://api.anthropic.com/v1/models'
      headers = {
        'x-api-key': apiKey as string,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    } else {
      return res.status(400).json({ error: 'Unsupported provider' })
    }

    const response = await fetch(url, { headers })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[sidecar] Model fetch error: ${response.status} ${errorText}`)
      return res.status(response.status).json({ 
        error: `Failed to fetch models: ${response.status} ${response.statusText}`,
        details: errorText
      })
    }

    const data = await response.json()
    console.log(`[sidecar] Successfully fetched models for ${provider}`)
    
    res.json(data)
  } catch (error) {
    console.error('[sidecar] Model fetch error:', error)
    res.status(500).json({ 
      error: 'Failed to fetch models',
      details: error instanceof Error ? error.message : 'Unknown error'
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
    const googleStatus = await googleOAuthChecker.checkStatus()
    
    const tools = []
    if (googleStatus.connected) {
      tools.push(
        { name: 'gmail', description: 'Gmail email management tools' },
        { name: 'drive', description: 'Google Drive file management tools' },
        { name: 'calendar', description: 'Google Calendar event management tools' },
        { name: 'sheets', description: 'Google Sheets spreadsheet tools' },
        { name: 'chat', description: 'Google Chat messaging tools' },
        { name: 'forms', description: 'Google Forms creation and management tools' },
        { name: 'slides', description: 'Google Slides presentation tools' },
        { name: 'tasks', description: 'Google Tasks management tools' },
        { name: 'search', description: 'Google Search tools' }
      )
    }
    
    res.json({ 
      tools,
      googleConnected: googleStatus.connected
    })
  } catch (error) {
    console.error('[sidecar] Tools error:', error)
    res.status(500).json({ error: 'Failed to get tools' })
  }
})

// Google OAuth status endpoint
app.get('/api/google/status', async (_req, res) => {
  try {
    const status = await googleOAuthChecker.checkStatus()
    console.log('[sidecar] Google status requested:', status)
    res.json(status)
  } catch (error) {
    console.error('[sidecar] Google status error:', error)
    res.status(500).json({ error: 'Failed to get Google status' })
  }
})

// Google OAuth disconnect endpoint
app.post('/api/google/disconnect', async (_req, res) => {
  try {
    console.log('[sidecar] Google disconnect requested')
    
    // Revoke tokens and clear credentials
    const result = await googleOAuthChecker.disconnect()
    await mcpManager.stop()
    
    console.log('[sidecar] Google disconnect result:', result)
    res.json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[sidecar] Google disconnect error:', error)
    res.status(500).json({ 
      success: false,
      error: 'Failed to disconnect from Google',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Test endpoint to trigger Google OAuth flow
app.post('/api/google/connect', async (_req, res) => {
  try {
    console.log('[sidecar] Google connect endpoint called')
    
    // Build minimal settings using env keys for OAuth trigger
    const settings: SettingsState = {
      selectedProvider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
      openAiApiKey: process.env.OPENAI_API_KEY || '',
      claudeApiKey: process.env.ANTHROPIC_API_KEY || '',
      selectedModel: 'gpt-4o-mini',
      customModel: '',
      systemPrompt: '',
      googleConnected: false,
      googleOAuthClientId: googleOAuthChecker.getClientId() || undefined,
      googleOAuthClientSecret: googleOAuthChecker.getClientSecret() || undefined
    }

    console.log('[sidecar] Google OAuth settings:', {
      clientId: settings.googleOAuthClientId ? 'SET' : 'NOT SET',
      clientSecret: settings.googleOAuthClientSecret ? 'SET' : 'NOT SET'
    })

    console.log('[sidecar] Starting Google OAuth flow via MCP server...')
    
    // Start HTTP MCP server only when explicitly using HTTP transport
    if ((process.env.GOOGLE_MCP_TRANSPORT || '').toLowerCase() === 'http') {
      if (!mcpManager.isRunning()) {
        console.log('[sidecar] Starting MCP server for OAuth (HTTP mode)...')
        await mcpManager.start()
      }
    } else {
      console.log('[sidecar] STDIO mode selected - no HTTP server startup required')
    }
    
    // Use the exact pattern from the reference repo
    const result = await smartAgent.startGoogleOAuth(settings)
    console.log('[sidecar] OAuth result:', result)
    
    res.json({ success: true, message: result, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('[sidecar] Google connect error:', error)
    res.status(500).json({ 
      success: false,
      error: 'Failed to trigger Google connect',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Google Workspace test endpoint
app.post('/api/google/test', async (req, res) => {
  try {
    console.log('[sidecar] Google Workspace test requested')
    
    // Get current settings from request or use defaults
    const settings: SettingsState = {
      selectedProvider: req.body.provider || 'claude',
      apiKey: req.body.apiKey || '',
      openAiApiKey: req.body.openAiApiKey || '',
      claudeApiKey: req.body.claudeApiKey || '',
      selectedModel: req.body.model || 'claude-3-5-haiku-20241022',
      customModel: req.body.customModel || '',
      systemPrompt: req.body.systemPrompt || '',
      googleConnected: true, // Assume connected for testing
      googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET
    }

    // Test Google Workspace access
    const testResults = await smartAgent.testGoogleWorkspaceAccess()
    
    console.log('[sidecar] Google Workspace test results:', testResults)
    res.json({
      success: true,
      results: testResults,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[sidecar] Error testing Google Workspace:', error)
    res.status(500).json({ 
      success: false,
      error: 'Failed to test Google Workspace access',
      details: error.message 
    })
  }
})

// ===== TRANSCRIPT API ENDPOINTS =====

// List all transcripts
app.get('/api/transcripts', transcriptAPI.listTranscripts)

// Get specific transcript
app.get('/api/transcripts/:date/:filename', transcriptAPI.getTranscript)

// Delete transcript
app.delete('/api/transcripts/:date/:filename', transcriptAPI.deleteTranscript)

// Get transcript system statistics
app.get('/api/transcripts/stats', transcriptAPI.getStats)

// Get detailed system status
app.get('/api/transcripts/status', transcriptAPI.getStatus)

// Force generate transcripts immediately
app.post('/api/transcripts/generate', transcriptAPI.forceGenerate)

// Start transcript timer
app.post('/api/transcripts/timer/start', transcriptAPI.startTimer)

// Stop transcript timer
app.post('/api/transcripts/timer/stop', transcriptAPI.stopTimer)

// Get active chat sessions
app.get('/api/transcripts/sessions', transcriptAPI.getActiveSessions)

// Get specific session details
app.get('/api/transcripts/sessions/:sessionId', transcriptAPI.getSession)

app.listen(port, () => {
  console.log(`🚀 Smart MCP Chat Server running on http://localhost:${port}`)
  console.log(`📡 API endpoints:`)
  console.log(`   POST /api/chat/stream - Send messages to smart MCP agent (streaming)`) 
  console.log(`   POST /api/chat - Send messages to smart MCP agent (non-streaming)`) 
  console.log(`   GET  /api/health - Health check`) 
  console.log(`   GET  /api/tools - List available MCP tools`)
  console.log(`   GET  /api/models - Fetch available models`)
  console.log(`   GET  /api/google/status - Google OAuth status`)
  console.log(`   POST /api/google/connect - Connect to Google Suite`)
  console.log(`   POST /api/google/disconnect - Disconnect from Google Suite`)
  console.log(`   POST /api/google/test - Test Google Workspace access`)
  console.log(`📝 Transcript endpoints:`)
  console.log(`   GET  /api/transcripts - List all transcripts`)
  console.log(`   GET  /api/transcripts/:date/:filename - Get specific transcript`)
  console.log(`   GET  /api/transcripts/stats - Get transcript statistics`)
  console.log(`   POST /api/transcripts/generate - Force generate transcripts`)
  console.log(`   POST /api/transcripts/timer/start - Start transcript timer`)
  console.log(`   POST /api/transcripts/timer/stop - Stop transcript timer`)
  console.log(`🧠 Smart agent: Context-aware MCP tool selection`)
  console.log(`⚡ Rate limiting: Optimized for high-volume usage`)
  console.log(`📋 Transcript logging: Automatic every 5 minutes`)
  
  // Start the transcript timer
  transcriptTimer.start()
  console.log(`🕐 Transcript timer started - will generate transcripts every 5 minutes`)
})

// Note: Signal handlers removed to prevent immediate shutdown
// The sidecar will run indefinitely until the parent process terminates it