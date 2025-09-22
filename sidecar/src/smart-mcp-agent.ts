import { MCPAgent, MCPClient } from 'mcp-use';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { MCPConfigManager, SettingsState } from './mcp-config.js';
import { GoogleWorkspaceMCP } from './google-workspace-mcp.js';
import { RateLimiter } from './rate-limiter.js';
import { extractUserMessage, needsMCPTools as checkNeedsMCPTools } from './parsing/message-extraction.js';

export class SmartMCPAgent {
  private mcpClient: MCPClient | null = null;
  private agent: MCPAgent | null = null;
  private googleWorkspaceMCP: GoogleWorkspaceMCP | null = null;
  private configManager: MCPConfigManager;
  private rateLimiter: RateLimiter;
  private lastSettings: SettingsState | null = null;

  constructor() {
    this.configManager = MCPConfigManager.getInstance();
    this.rateLimiter = RateLimiter.getInstance();
    this.googleWorkspaceMCP = new GoogleWorkspaceMCP();
  }

  /**
   * Initialize MCP client and agent with current settings
   * Following the research patterns for proper Google Workspace integration
   */
  async initialize(settings: SettingsState): Promise<void> {
    try {
      console.log(`[SmartMCP] 🚀 Initializing with provider: ${settings.selectedProvider}`);
      console.log(`[SmartMCP] 🚀 Google connected: ${settings.googleConnected}`);
      console.log(`[SmartMCP] 🚀 Google OAuth Client ID: ${settings.googleOAuthClientId ? 'SET' : 'NOT SET'}`);
      console.log(`[SmartMCP] 🚀 Google OAuth Client Secret: ${settings.googleOAuthClientSecret ? 'SET' : 'NOT SET'}`);
      
      // If Google is connected, use the dedicated Google Workspace MCP integration
      if (settings.googleConnected && this.googleWorkspaceMCP) {
        console.log(`[SmartMCP] 🔧 Using dedicated Google Workspace MCP integration...`);
        const { client, agent } = await this.googleWorkspaceMCP.createGoogleWorkspaceAgent(settings);
        this.mcpClient = client;
        this.agent = agent;
        console.log(`[SmartMCP] ✅ Google Workspace MCP agent created successfully`);
      } else {
        // Fallback to generic MCP client for non-Google scenarios
        console.log(`[SmartMCP] 🔧 Creating generic MCP client...`);
        this.mcpClient = await this.configManager.createMCPClient(settings);
        console.log(`[SmartMCP] 🔧 MCP client created: ${!!this.mcpClient}`);
        
        if (this.mcpClient) {
          console.log(`[SmartMCP] 🔧 Creating generic MCP agent...`);
          const llm = this.createLLM(settings);
          this.agent = new MCPAgent({
            llm: llm as any,
            client: this.mcpClient,
            maxSteps: 10,
            useServerManager: false,
            verbose: true
          });
          console.log(`[SmartMCP] ✅ Generic MCP agent created successfully`);
        } else {
          console.log(`[SmartMCP] ❌ No MCP client available, will use direct LLM only`);
          this.agent = null;
        }
      }

      this.lastSettings = settings;
      console.log(`[SmartMCP] ✅ Initialized successfully`);
      
    } catch (error) {
      console.error(`[SmartMCP] ❌ Initialization failed:`, error);
      console.error(`[SmartMCP] ❌ Error type:`, typeof error);
      console.error(`[SmartMCP] ❌ Error message:`, error?.message);
      console.error(`[SmartMCP] ❌ Error stack:`, error?.stack);
      // Don't throw error, just log it and continue with direct LLM
      console.log(`[SmartMCP] 🔄 Will use direct LLM fallback`);
      this.agent = null;
      this.mcpClient = null;
    }
  }

  /**
   * Create LLM instance based on provider
   */
  private createLLM(settings: SettingsState) {
    const provider = settings.selectedProvider.toLowerCase();
    const model = settings.selectedModel || settings.customModel || 'gpt-4o-mini';
    
    console.log(`[SmartMCP] Creating LLM: provider=${provider}, model=${model}`);
    
    if (provider === 'openai') {
      const apiKey = settings.openAiApiKey || settings.apiKey;
      if (!apiKey) throw new Error('OpenAI API key required');
      
      return new ChatOpenAI({
        modelName: model.startsWith('gpt-') ? model : 'gpt-4o-mini',
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
   * Analyze message to determine if MCP tools are needed
   */
  private needsMCPTools(message: string, googleConnected: boolean = false): boolean {
    // Extract the actual user message from the raw input
    const userMessage = extractUserMessage(message);
    
    console.log(`[SmartMCP] 🔍 Raw message: "${message}"`);
    console.log(`[SmartMCP] 🔍 Extracted user message: "${userMessage}"`);
    console.log(`[SmartMCP] 🔍 Google connected: ${googleConnected}`);
    
    // Use the enhanced detection function with Google connection status
    const needsMCP = checkNeedsMCPTools(userMessage, googleConnected);
    
    console.log(`[SmartMCP] 🔍 MCP needed: ${needsMCP}`);
    
    if (needsMCP) {
      console.log(`[SmartMCP] ✅ Google-related message detected - will use MCP agent`);
    } else {
      console.log(`[SmartMCP] ❌ Non-Google message detected - using direct LLM`);
    }
    
    return needsMCP;
  }

  /**
   * Run message through MCP agent or direct LLM
   * Using proper tool execution verification as recommended in research
   */
  async run(message: string, settings: SettingsState): Promise<string> {
    try {
      console.log(`[SmartMCP] 🚀 Starting run with message: "${message.substring(0, 100)}..."`);
      console.log(`[SmartMCP] 🚀 Settings: provider=${settings.selectedProvider}, googleConnected=${settings.googleConnected}`);
      
      // Check if we need to reinitialize (settings changed)
      if (this.needsReinitialization(settings)) {
        console.log(`[SmartMCP] Settings changed, reinitializing...`);
        await this.initialize(settings);
      }

      // Check if this message contains document context
      const hasDocumentContext = message.includes('=== DOCUMENTS AVAILABLE ===');
      console.log(`[SmartMCP] 🔍 Has document context: ${hasDocumentContext}`);
      
      // Extract the actual user message from the raw input
      const userMessage = extractUserMessage(message);
      console.log(`[SmartMCP] 🚀 Extracted user message: "${userMessage}"`);
      
      // Check if MCP tools are needed (only for Google-related prompts when connected)
      const needsMCP = this.needsMCPTools(message, settings.googleConnected);
      
      // Debug MCP availability
      console.log(`[SmartMCP] 🔍 MCP Analysis:`);
      console.log(`[SmartMCP] 🔍 - needsMCP: ${needsMCP}`);
      console.log(`[SmartMCP] 🔍 - agent exists: ${!!this.agent}`);
      console.log(`[SmartMCP] 🔍 - mcpClient exists: ${!!this.mcpClient}`);
      console.log(`[SmartMCP] 🔍 - googleConnected: ${settings.googleConnected}`);
      console.log(`[SmartMCP] 🔍 - googleWorkspaceMCP exists: ${!!this.googleWorkspaceMCP}`);
      
      // If no MCP tools needed or no MCP servers configured, use direct LLM
      if (!needsMCP || !this.agent || !this.mcpClient) {
        console.log(`[SmartMCP] ❌ Using direct LLM (no MCP tools needed or no MCP servers configured)`);
        console.log(`[SmartMCP] ❌ Reasons: needsMCP=${needsMCP}, agent=${!!this.agent}, mcpClient=${!!this.mcpClient}`);
        
        // If we have document context, pass the full message to preserve it
        const messageToUse = hasDocumentContext ? message : userMessage;
        console.log(`[SmartMCP] 🔍 Using ${hasDocumentContext ? 'full message with context' : 'extracted user message'}`);
        return await this.runDirectLLM(messageToUse, settings);
      }

      // Check rate limits
      await this.rateLimiter.checkAndWait('mcp', 'agent_run');
      
      // Add delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Only use Google Workspace MCP for Google-related prompts when connected
      if (needsMCP && settings.googleConnected && this.googleWorkspaceMCP) {
        console.log(`[SmartMCP] 🚀 Using Google Workspace MCP for Google-related prompt...`);
        const messageToUse = hasDocumentContext ? message : userMessage;
        return await this.googleWorkspaceMCP.runWithToolVerification(messageToUse);
      } else if (needsMCP) {
        // Use generic MCP agent for non-Google MCP needs
        console.log(`[SmartMCP] 🚀 Using generic MCP agent...`);
        const messageToUse = hasDocumentContext ? message : userMessage;
        return await this.runGenericMCPAgent(userMessage, settings, messageToUse);
      } else {
        // Use direct LLM for non-MCP prompts
        console.log(`[SmartMCP] 🚀 Using direct LLM for non-MCP prompt...`);
        return await this.runDirectLLM(message, settings);
      }
      
    } catch (error) {
      console.error(`[SmartMCP] ❌ Error in run:`, error);
      console.error(`[SmartMCP] ❌ Error type:`, typeof error);
      console.error(`[SmartMCP] ❌ Error message:`, error?.message);
      console.error(`[SmartMCP] ❌ Error stack:`, error?.stack);
      
      // Check if it's a quota error
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = String(error.message);
        if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('insufficient_quota')) {
          console.log(`[SmartMCP] API quota exceeded, returning helpful message`);
          return "I'm sorry, but the API quota has been exceeded. Please check your API key billing and try again later, or use a different API key in the settings.";
        }
      }
      
      // Fallback to direct LLM if MCP fails
      console.log(`[SmartMCP] 🔄 Falling back to direct LLM`);
      return await this.runDirectLLM(message, settings);
    }
  }

  /**
   * Run generic MCP agent (fallback for non-Google scenarios)
   */
  private async runGenericMCPAgent(userMessage: string, settings: SettingsState, fullMessage?: string): Promise<string> {
    if (!this.agent) {
      throw new Error('MCP agent not initialized');
    }

    // If we have document context, pass the full message to preserve it
    const messageToUse = fullMessage || userMessage;
    const hasContext = fullMessage && fullMessage.includes('=== DOCUMENTS AVAILABLE ===');
    console.log(`[SmartMCP] 🚀 Running generic MCP agent with ${hasContext ? 'full message with context' : 'user message'}: "${messageToUse.substring(0, 100)}..."`);
    
    const result = await this.agent.run(messageToUse);
    
    console.log(`[SmartMCP] ✅ Generic MCP agent completed successfully`);
    console.log(`[SmartMCP] ✅ Result type: ${typeof result}`);
    console.log(`[SmartMCP] ✅ Result preview: ${JSON.stringify(result).substring(0, 200)}...`);
    
    // Record successful request
    await this.rateLimiter.recordRequest('mcp', 'agent_run');
    
    // Extract text content from result
    return this.extractTextContent(result);
  }

  /**
   * Extract text content from various result formats
   */
  private extractTextContent(result: any): string {
    if (typeof result === 'string') {
      return result;
    } else if (Array.isArray(result)) {
      // Handle array of message objects (common MCP response format)
      return (result as any[])
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item?.text) return item.text;
          if (item?.content) return item.content;
          if (item?.message) return item.message;
          return '';
        })
        .filter(Boolean)
        .join('\n');
    } else if (result && typeof result === 'object') {
      // Handle object response - look for common response patterns
      const resultObj = result as any;
      if (resultObj.content) {
        return resultObj.content;
      } else if (resultObj.text) {
        return resultObj.text;
      } else if (resultObj.message) {
        return resultObj.message;
      } else if (resultObj.output) {
        return resultObj.output;
      } else if (resultObj.response) {
        return resultObj.response;
      } else {
        // Try to extract meaningful content from the object
        const stringified = JSON.stringify(result);
        // If it's a complex object, try to find the actual response
        if (stringified.includes('"text"') || stringified.includes('"content"')) {
          // Look for nested text/content
          const textMatch = stringified.match(/"text":\s*"([^"]+)"/);
          const contentMatch = stringified.match(/"content":\s*"([^"]+)"/);
          if (textMatch) {
            return textMatch[1];
          } else if (contentMatch) {
            return contentMatch[1];
          } else {
            return stringified;
          }
        } else {
          return stringified;
        }
      }
    } else {
      return String(result);
    }
  }

  /**
   * Run message through direct LLM (no MCP tools)
   */
  private async runDirectLLM(message: string, settings: SettingsState): Promise<string> {
    try {
      const llm = this.createLLM(settings);
      
      // Check rate limits for direct LLM
      const provider = settings.selectedProvider.toLowerCase();
      await this.rateLimiter.checkAndWait(provider, 'direct_llm');
      
      // Use the full message as-is (it already contains system prompt and document context)
      const prompt = message;
      
      // Use the LLM directly
      const response = await llm.invoke(prompt);
      const result = typeof response === 'string' ? response : String(response.content || response);
      
      // Record successful request
      await this.rateLimiter.recordRequest(provider, 'direct_llm');
      
      return result;
      
    } catch (error) {
      console.error(`[SmartMCP] Direct LLM failed:`, error);
      
      // Check if it's a quota error
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = String(error.message);
        if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('insufficient_quota')) {
          console.log(`[SmartMCP] API quota exceeded in direct LLM`);
          return "I'm sorry, but the API quota has been exceeded. Please check your API key billing and try again later, or use a different API key in the settings.";
        }
      }
      
      throw error;
    }
  }

  /**
   * Test Google Workspace access (for debugging)
   */
  async testGoogleWorkspaceAccess(): Promise<{ gmail: string; calendar: string }> {
    if (!this.googleWorkspaceMCP) {
      return {
        gmail: '❌ Google Workspace MCP not initialized',
        calendar: '❌ Google Workspace MCP not initialized'
      };
    }

    try {
      const [gmailResult, calendarResult] = await Promise.all([
        this.googleWorkspaceMCP.testGmailAccess(),
        this.googleWorkspaceMCP.testCalendarAccess()
      ]);

      return {
        gmail: gmailResult,
        calendar: calendarResult
      };
    } catch (error) {
      console.error(`[SmartMCP] Google Workspace test failed:`, error);
      return {
        gmail: `❌ Gmail test failed: ${error.message}`,
        calendar: `❌ Calendar test failed: ${error.message}`
      };
    }
  }

  /**
   * Start Google OAuth via Workspace MCP (uses start_google_auth tool when available)
   */
  async startGoogleOAuth(settings: SettingsState): Promise<string> {
    if (!this.googleWorkspaceMCP) return 'Google Workspace MCP not initialized'
    try {
      // Do not initialize LLM/agent; OAuth must not require an API key
      return await this.googleWorkspaceMCP!.startGoogleOAuth(settings)
    } catch (e: any) {
      return `Failed to start Google OAuth: ${e?.message || String(e)}`
    }
  }

  /**
   * Check if reinitialization is needed
   */
  private needsReinitialization(settings: SettingsState): boolean {
    if (!this.lastSettings) return true;
    
    return (
      this.lastSettings.selectedProvider !== settings.selectedProvider ||
      this.lastSettings.selectedModel !== settings.selectedModel ||
      this.lastSettings.googleConnected !== settings.googleConnected ||
      this.lastSettings.openAiApiKey !== settings.openAiApiKey ||
      this.lastSettings.claudeApiKey !== settings.claudeApiKey
    );
  }

  /**
   * Get available tools
   */
  getAvailableTools(): string[] {
    if (!this.lastSettings) return [];
    return this.configManager.getAvailableTools(this.lastSettings);
  }

  /**
   * Check if Google Workspace is available
   */
  isGoogleWorkspaceAvailable(): boolean {
    if (!this.lastSettings) return false;
    return this.configManager.isGoogleWorkspaceAvailable(this.lastSettings);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.googleWorkspaceMCP) {
        await this.googleWorkspaceMCP.cleanup();
      }
      
      if (this.mcpClient) {
        await this.mcpClient.closeAllSessions();
        this.mcpClient = null;
      }
      this.agent = null;
      this.lastSettings = null;
      console.log(`[SmartMCP] Cleanup completed`);
    } catch (error) {
      console.error(`[SmartMCP] Cleanup error:`, error);
    }
  }
}