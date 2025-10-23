import { MCPClient, MCPAgent } from 'mcp-use';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { SettingsState } from './mcp-config.js';

/**
 * Google Workspace MCP Integration
 * Based on research from taylorwilsdon/google_workspace_mcp and mcp-use-ts
 */
export class GoogleWorkspaceMCP {
  private client: MCPClient | null = null;
  private agent: MCPAgent | null = null;
  private settings: SettingsState | null = null;

  /**
   * Create Google Workspace MCP client and agent
   * Following the exact pattern from mcp-use-ts documentation
   */
  async createGoogleWorkspaceAgent(settings: SettingsState): Promise<{ client: MCPClient; agent: MCPAgent }> {
    console.log(`[GoogleWorkspaceMCP] 🚀 Creating Google Workspace agent with provider: ${settings.selectedProvider}`);
    
    // Create MCP client following the research pattern
    // Resolve a shared credentials directory so both app and MCP server see the same tokens
    const appData = process.env.APPDATA || process.env.HOME || process.cwd();
    const sharedCredsDir = `${appData.replace(/\\$/,'')}\\ArkAngel\\google_oauth\\credentials`;
    
    // Build client using STDIO by default (HTTP only when explicitly toggled)
    const useHttp = (process.env.GOOGLE_MCP_TRANSPORT || '').toLowerCase() === 'http';
    const client = MCPClient.fromDict({
      mcpServers: {
        google_workspace: useHttp
          ? {
              transport: 'http',
              url: 'http://127.0.0.1:8000/mcp',
              env: {
                GOOGLE_OAUTH_CLIENT_ID: settings.googleOAuthClientId || process.env.GOOGLE_OAUTH_CLIENT_ID || '',
                GOOGLE_OAUTH_CLIENT_SECRET: settings.googleOAuthClientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
                GOOGLE_MCP_CREDENTIALS_DIR: sharedCredsDir,
                LOG_LEVEL: process.env.LOG_LEVEL || 'DEBUG',
                OAUTHLIB_INSECURE_TRANSPORT: process.env.OAUTHLIB_INSECURE_TRANSPORT || '1'
              }
            }
          : {
              command: 'uvx',
              args: ['workspace-mcp', '--tool-tier', 'complete', '--tools', 'gmail', 'calendar', 'drive', 'docs', 'sheets', '--transport', 'stdio'],
              env: {
                GOOGLE_OAUTH_CLIENT_ID: settings.googleOAuthClientId || process.env.GOOGLE_OAUTH_CLIENT_ID || '',
                GOOGLE_OAUTH_CLIENT_SECRET: settings.googleOAuthClientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
                GOOGLE_MCP_CREDENTIALS_DIR: sharedCredsDir,
                LOG_LEVEL: process.env.LOG_LEVEL || 'DEBUG',
                OAUTHLIB_INSECURE_TRANSPORT: process.env.OAUTHLIB_INSECURE_TRANSPORT || '1'
              }
            }
      }
    });

    console.log(`[GoogleWorkspaceMCP] ✅ MCP client created successfully`);

    // Create LLM based on provider (following research patterns)
    const llm = this.createLLM(settings);
    console.log(`[GoogleWorkspaceMCP] ✅ LLM created: ${settings.selectedProvider}`);

    // Create MCP agent with proper configuration and system prompt
    const agent = new MCPAgent({ 
      llm: llm as any, 
      client, 
      maxSteps: 20, // Increased for proper tool execution
      verbose: true, // Enable verbose logging
      systemPrompt: `You are a helpful AI assistant with access to Google Workspace tools including Gmail, Calendar, Drive, Docs, and Sheets. 

When users ask about their emails, calendar events, documents, or other Google Workspace data, you should use the available tools to retrieve and provide real information. 

For Gmail requests, use search_gmail_messages to find emails and get_gmail_message_content to read specific messages.
For Calendar requests, use get_events to retrieve calendar events and list_calendars to see available calendars.
For Drive requests, use search_drive_files to find files and get_drive_file_content to read file contents.

CRITICAL IDENTITY RULES:
1) Never ask the user for their Gmail address and never include a 'user_google_email' field in tool arguments.
2) Identity must be derived from the authenticated OAuth token stored by the MCP server. If Google Suite is not connected, do not attempt tools.
3) If Google Suite is disconnected, respond normally using the LLM and suggest connecting Google Suite.

OAUTH AUTHENTICATION:
- When users need to authenticate with Google Workspace, use the start_google_auth tool to initiate the OAuth flow.
- The start_google_auth tool will provide an authorization URL that users can open in their browser.
- After completing authentication, the tool will automatically handle token storage and refresh.

Always use the tools when appropriate to provide accurate, up-to-date information from the user's Google Workspace.`
    });

    console.log(`[GoogleWorkspaceMCP] ✅ MCP agent created successfully`);
    
    this.client = client;
    this.agent = agent;
    this.settings = settings;

    return { client, agent };
  }

  /**
   * Create LLM instance based on provider
   * Following the exact patterns from mcp-use-ts documentation
   */
  private createLLM(settings: SettingsState) {
    const provider = settings.selectedProvider.toLowerCase();
    const model = settings.selectedModel || settings.customModel || 'gpt-4o-mini';
    
    console.log(`[GoogleWorkspaceMCP] Creating LLM: provider=${provider}, model=${model}`);
    
    if (provider === 'openai') {
      const apiKey = settings.openAiApiKey || settings.apiKey;
      if (!apiKey) throw new Error('OpenAI API key required');
      
      return new ChatOpenAI({
        modelName: model.startsWith('gpt-') ? model : 'gpt-4o',
        temperature: 0.5,
        streaming: false,
        apiKey,
        maxRetries: 3,
        maxConcurrency: 1
      });
    } else if (provider === 'claude' || provider === 'anthropic') {
      const apiKey = settings.claudeApiKey || settings.apiKey;
      if (!apiKey) throw new Error('Anthropic API key required');
      
      return new ChatAnthropic({
        model: model.startsWith('claude-') ? model : 'claude-3-5-sonnet-20241022',
        temperature: 0.5,
        apiKey,
        maxRetries: 3,
        maxConcurrency: 1
      });
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Run query with proper tool execution verification
   * Using streamEvents() to prove tool execution as recommended in research
   */
  async runWithToolVerification(query: string): Promise<string> {
    if (!this.agent) {
      throw new Error('Google Workspace agent not initialized');
    }

    console.log(`[GoogleWorkspaceMCP] 🚀 Running query with tool verification: "${query}"`);
    
    // Use streamEvents to verify tool execution
    const events = this.agent.streamEvents(query);
    let finalResponse = '';
    let toolExecuted = false;
    let lastToolName = '';
    let toolObservations: any[] = [];

    for await (const event of events) {
      console.log(`[GoogleWorkspaceMCP] 📡 Event: ${event.event}`);
      
      if (event.event === 'on_tool_start') {
        console.log(`[GoogleWorkspaceMCP] 🔧 TOOL START: ${event.name}`);
        console.log(`[GoogleWorkspaceMCP] 🔧 Tool input:`, JSON.stringify(event.data?.input).substring(0, 200));
        toolExecuted = true;
        lastToolName = event.name;
      }
      
      if (event.event === 'on_tool_end') {
        console.log(`[GoogleWorkspaceMCP] ✅ TOOL END: ${event.name}`);
        console.log(`[GoogleWorkspaceMCP] ✅ Tool output preview:`, JSON.stringify(event.data?.output).substring(0, 200));
        
        // Capture tool observations for better result processing
        if (event.data?.output) {
          toolObservations.push({
            tool: event.name,
            output: event.data.output
          });
        }
      }
      
      if (event.event === 'on_chain_end') {
        console.log(`[GoogleWorkspaceMCP] 🏁 CHAIN END`);
        if (event.data?.output) {
          finalResponse = typeof event.data.output === 'string' 
            ? event.data.output 
            : JSON.stringify(event.data.output);
        }
      }
      
      if (event.event === 'on_llm_end') {
        console.log(`[GoogleWorkspaceMCP] 🧠 LLM END`);
        if (event.data?.output) {
          const output = event.data.output;
          if (typeof output === 'string') {
            finalResponse = output;
          } else if (output && typeof output === 'object' && 'content' in output) {
            finalResponse = String(output.content);
          }
        }
      }
    }

    if (toolExecuted) {
      console.log(`[GoogleWorkspaceMCP] ✅ Tools were executed successfully (last tool: ${lastToolName})`);
      console.log(`[GoogleWorkspaceMCP] ✅ Tool observations captured: ${toolObservations.length}`);
    } else {
      console.log(`[GoogleWorkspaceMCP] ⚠️ No tools were executed - this might indicate a problem`);
    }

    // If we have tool observations, try to extract meaningful content
    if (toolObservations.length > 0 && !finalResponse) {
      console.log(`[GoogleWorkspaceMCP] 🔄 Extracting content from tool observations`);
      finalResponse = this.extractContentFromToolObservations(toolObservations);
    }

    return finalResponse || 'I apologize, but I was unable to process your request. Please try again.';
  }

  /**
   * Extract meaningful content from tool observations
   * This helps show actual Gmail/Calendar data instead of planning text
   */
  private extractContentFromToolObservations(observations: any[]): string {
    const results: string[] = [];
    
    for (const obs of observations) {
      if (obs.output) {
        // Try to extract meaningful content from tool output
        if (typeof obs.output === 'string') {
          results.push(obs.output);
        } else if (obs.output.content) {
          results.push(obs.output.content);
        } else if (obs.output.text) {
          results.push(obs.output.text);
        } else if (obs.output.messages) {
          // Handle Gmail messages
          const messages = obs.output.messages;
          if (Array.isArray(messages) && messages.length > 0) {
            const message = messages[0];
            results.push(`Subject: ${message.subject || 'No subject'}`);
            results.push(`From: ${message.sender || 'Unknown sender'}`);
            results.push(`Date: ${message.date || 'Unknown date'}`);
            if (message.snippet) {
              results.push(`Preview: ${message.snippet}`);
            }
          }
        } else if (obs.output.events) {
          // Handle Calendar events
          const events = obs.output.events;
          if (Array.isArray(events) && events.length > 0) {
            const event = events[0];
            results.push(`Event: ${event.summary || 'No title'}`);
            results.push(`Time: ${event.start?.dateTime || event.start?.date || 'Unknown time'}`);
            if (event.description) {
              results.push(`Description: ${event.description}`);
            }
          }
        } else {
          // Fallback: stringify the output
          results.push(JSON.stringify(obs.output));
        }
      }
    }
    
    return results.join('\n\n');
  }

  /**
   * Direct tool call for debugging (as recommended in research)
   * This allows us to test Gmail/Calendar tools directly using the agent
   */
  async callToolDirectly(toolName: string, args: any): Promise<any> {
    if (!this.agent) {
      throw new Error('MCP agent not initialized');
    }

    console.log(`[GoogleWorkspaceMCP] 🔧 Calling tool directly: ${toolName}`);
    console.log(`[GoogleWorkspaceMCP] 🔧 Tool args:`, JSON.stringify(args));

    try {
      // Use the agent to call the tool directly
      // Create a specific prompt that will trigger the tool
      const prompt = `Please use the ${toolName} tool with these arguments: ${JSON.stringify(args)}`;
      
      const result = await this.agent.run(prompt);
      console.log(`[GoogleWorkspaceMCP] ✅ Tool result:`, JSON.stringify(result).substring(0, 500));
      
      return result;
    } catch (error) {
      console.error(`[GoogleWorkspaceMCP] ❌ Direct tool call failed:`, error);
      throw error;
    }
  }

  /**
   * Test Gmail access with direct tool call
   */
  async testGmailAccess(): Promise<string> {
    try {
      console.log(`[GoogleWorkspaceMCP] 🧪 Testing Gmail access...`);
      
      const result = await this.callToolDirectly('search_gmail_messages', {
        query: 'newer_than:7d',
        max_results: 1
      });

      if (result && result.messages && result.messages.length > 0) {
        const message = result.messages[0];
        return `✅ Gmail access working! Latest email: "${message.subject || 'No subject'}" from ${message.sender || 'Unknown sender'}`;
      } else {
        return '✅ Gmail access working, but no recent messages found.';
      }
    } catch (error) {
      console.error(`[GoogleWorkspaceMCP] ❌ Gmail test failed:`, error);
      return `❌ Gmail access failed: ${error.message}`;
    }
  }

  /**
   * Test Calendar access with direct tool call
   */
  async testCalendarAccess(): Promise<string> {
    try {
      console.log(`[GoogleWorkspaceMCP] 🧪 Testing Calendar access...`);
      
      const result = await this.callToolDirectly('get_events', {
        calendar_id: 'primary',
        max_results: 1
      });

      if (result && result.events && result.events.length > 0) {
        const event = result.events[0];
        return `✅ Calendar access working! Next event: "${event.summary || 'No title'}" at ${event.start?.dateTime || event.start?.date || 'Unknown time'}`;
      } else {
        return '✅ Calendar access working, but no upcoming events found.';
      }
    } catch (error) {
      console.error(`[GoogleWorkspaceMCP] ❌ Calendar test failed:`, error);
      return `❌ Calendar access failed: ${error.message}`;
    }
  }

  /**
   * Start Google OAuth flow using MCP server's start_google_auth tool
   * This matches the reference repository's approach exactly
   */
  async startGoogleOAuth(settings: SettingsState): Promise<string> {
    try {
      console.log('[GoogleWorkspaceMCP] Starting Google OAuth flow via MCP server...')
      
      const clientId = settings.googleOAuthClientId || process.env.GOOGLE_OAUTH_CLIENT_ID
      const clientSecret = settings.googleOAuthClientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET
      
      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth Client ID and Secret are required')
      }
      
      console.log('[GoogleWorkspaceMCP] ✅ OAuth credentials found')
      console.log('[GoogleWorkspaceMCP] - Client ID:', clientId)
      console.log('[GoogleWorkspaceMCP] - Client Secret:', clientSecret.substring(0, 8) + '...')
      
      // Create MCP client for OAuth (following reference repo pattern)
      const { MCPClient } = await import('mcp-use')
      
      // Resolve a shared credentials directory so both app and MCP server see the same tokens
      const appData = process.env.APPDATA || process.env.HOME || process.cwd()
      const sharedCredsDir = `${appData.replace(/\\$/,'')}\\ArkAngel\\google_oauth\\credentials`
      
      console.log('[GoogleWorkspaceMCP] Creating MCP client for OAuth...')
      
      // Build client configuration matching STDIO (default) or HTTP (toggle) transports
      const useHttp = (process.env.GOOGLE_MCP_TRANSPORT || '').toLowerCase() === 'http'
      const client = MCPClient.fromDict({
        mcpServers: {
          google_workspace: useHttp
            ? {
                transport: 'http',
                url: 'http://127.0.0.1:8000/mcp',
                env: {
                  GOOGLE_OAUTH_CLIENT_ID: clientId,
                  GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
                  GOOGLE_MCP_CREDENTIALS_DIR: sharedCredsDir,
                  LOG_LEVEL: 'DEBUG',
                  OAUTHLIB_INSECURE_TRANSPORT: '1'
                }
              }
            : {
                command: 'uvx',
                args: ['workspace-mcp', '--tool-tier', 'complete', '--tools', 'gmail', 'calendar', 'drive', 'docs', 'sheets', '--transport', 'stdio'],
                env: {
                  GOOGLE_OAUTH_CLIENT_ID: clientId,
                  GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
                  GOOGLE_MCP_CREDENTIALS_DIR: sharedCredsDir,
                  LOG_LEVEL: 'DEBUG',
                  OAUTHLIB_INSECURE_TRANSPORT: '1'
                }
              }
        }
      })
      
      console.log('[GoogleWorkspaceMCP] ✅ MCP client created for OAuth')
      
      // Call the start_google_auth tool using the MCP client (transport-agnostic)
      console.log('[GoogleWorkspaceMCP] Calling start_google_auth tool via client...')
      let result: any
      try {
        if ((client as any).callTool) {
          result = await (client as any).callTool('start_google_auth', { service_name: 'Google Workspace', user_google_email: '' })
        } else if (useHttp) {
          const httpResp = await fetch('http://127.0.0.1:8000/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/call',
              params: { name: 'start_google_auth', arguments: { service_name: 'Google Workspace', user_google_email: '' } }
            })
          })
          if (!httpResp.ok) throw new Error(`HTTP ${httpResp.status}: ${httpResp.statusText}`)
          result = await httpResp.json()
        } else {
          throw new Error('MCP client does not expose callTool in STDIO mode')
        }
      } catch (primaryErr: any) {
        console.warn('[GoogleWorkspaceMCP] start_google_auth not available, falling back to a harmless list tool to trigger OAuth:', primaryErr?.message || primaryErr)
        // Fallback: trigger OAuth by calling a benign Calendar tool (names vary by server version)
        try {
          if ((client as any).callTool) {
            result = await (client as any).callTool('list_calendars', {})
          } else if (useHttp) {
            const httpResp = await fetch('http://127.0.0.1:8000/mcp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: { name: 'list_calendars', arguments: {} }
              })
            })
            if (!httpResp.ok) throw new Error(`HTTP ${httpResp.status}: ${httpResp.statusText}`)
            result = await httpResp.json()
          }
        } catch (fallbackErr: any) {
          console.warn('[GoogleWorkspaceMCP] list_calendars fallback failed, trying get_events (final fallback)...', fallbackErr?.message || fallbackErr)
          if ((client as any).callTool) {
            result = await (client as any).callTool('get_events', { calendar_id: 'primary', max_results: 1 })
          } else if (useHttp) {
            const httpResp = await fetch('http://127.0.0.1:8000/mcp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/call',
                params: { name: 'get_events', arguments: { calendar_id: 'primary', max_results: 1 } }
              })
            })
            if (!httpResp.ok) throw new Error(`HTTP ${httpResp.status}: ${httpResp.statusText}`)
            result = await httpResp.json()
          }
        }
      }
      
      console.log('[GoogleWorkspaceMCP] ✅ OAuth tool result:', result)
      
      // Extract the authorization URL from any available text
      const serialized = typeof result === 'string' ? result : JSON.stringify(result)
      const authUrlMatch = serialized.match(/https:\/\/accounts\.google\.com\/[^"]/)
      
      if (authUrlMatch) {
        const authUrl = authUrlMatch[0]
        console.log('[GoogleWorkspaceMCP] ✅ Extracted auth URL:', authUrl)
        console.log('[GoogleWorkspaceMCP] 🌐 Opening browser for OAuth authentication...')
        
        try {
          const { spawn } = await import('child_process')
          const open = (process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open')
          console.log('[GoogleWorkspaceMCP] 🚀 Executing browser command:', open, authUrl)
          
          const child = spawn(open, [authUrl], { shell: true, detached: true, stdio: 'ignore' })
          child.unref()
          
          console.log('[GoogleWorkspaceMCP] ✅ Browser opened successfully!')
          return `OAuth flow initiated successfully! Please complete authentication in your browser.\n\nAuthorization URL: ${authUrl}`
        } catch (browserError) {
          console.error('[GoogleWorkspaceMCP] ❌ Failed to open browser:', browserError)
          return `OAuth flow initiated but failed to open browser. Please manually visit: ${authUrl}`
        }
      } else {
        console.log('[GoogleWorkspaceMCP] ⚠️ Could not extract auth URL from result')
        return `OAuth flow initiated! Could not extract authorization URL. Raw result preview: ${serialized.substring(0, 500)}`
      }
    } catch (e: any) {
      console.error('[GoogleWorkspaceMCP] startGoogleOAuth error:', e)
      return `Failed to start OAuth: ${e?.message || String(e)}`
    }
  }


  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.client) {
        await this.client.closeAllSessions();
        this.client = null;
      }
      this.agent = null;
      this.settings = null;
      console.log(`[GoogleWorkspaceMCP] Cleanup completed`);
    } catch (error) {
      console.error(`[GoogleWorkspaceMCP] Cleanup error:`, error);
    }
  }
}
