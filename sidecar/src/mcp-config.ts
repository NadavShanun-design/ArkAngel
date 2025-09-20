import { MCPClient } from 'mcp-use';

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  tier?: 'core' | 'extended' | 'complete';
  tools?: string[];
}

export interface MCPConfiguration {
  servers: Record<string, MCPServerConfig>;
  defaultServers: string[];
  serverManager: boolean;
}

export interface SettingsState {
  selectedProvider: string;
  apiKey: string;
  openAiApiKey: string;
  claudeApiKey: string;
  selectedModel: string;
  customModel: string;
  systemPrompt: string;
  // Google OAuth status (from Tauri)
  googleConnected: boolean;
  googleOAuthClientId?: string;
  googleOAuthClientSecret?: string;
}

export class MCPConfigManager {
  private static instance: MCPConfigManager;
  private config: MCPConfiguration | null = null;

  static getInstance(): MCPConfigManager {
    if (!MCPConfigManager.instance) {
      MCPConfigManager.instance = new MCPConfigManager();
    }
    return MCPConfigManager.instance;
  }

  /**
   * Build MCP configuration based on current settings and Google OAuth status
   */
  buildMCPConfig(settings: SettingsState): MCPConfiguration {
    const servers: Record<string, MCPServerConfig> = {};

    // Configure Google Workspace MCP server (STDIO by default, HTTP behind toggle)
    const appData = process.env.APPDATA || process.env.HOME || process.cwd();
    const credsDir = `${String(appData).replace(/\\$/, '')}\\ArkAngel\\google_oauth\\credentials`;
    const useHttp = (process.env.GOOGLE_MCP_TRANSPORT || '').toLowerCase() === 'http';

    servers.google_workspace = {
      id: 'google_workspace',
      name: 'Google Workspace',
      command: 'uvx',
      args: useHttp
        ? ['workspace-mcp', '--tool-tier', 'complete', '--tools', 'gmail', 'calendar', 'drive', 'docs', 'sheets', '--transport', 'streamable-http']
        : ['workspace-mcp', '--tool-tier', 'complete', '--tools', 'gmail', 'calendar', 'drive', 'docs', 'sheets', '--transport', 'stdio'],
      env: {
        'GOOGLE_OAUTH_CLIENT_ID': settings.googleOAuthClientId || process.env.GOOGLE_OAUTH_CLIENT_ID || '',
        'GOOGLE_OAUTH_CLIENT_SECRET': settings.googleOAuthClientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
        'GOOGLE_MCP_CREDENTIALS_DIR': process.env.GOOGLE_MCP_CREDENTIALS_DIR || credsDir,
        'LOG_LEVEL': process.env.LOG_LEVEL || 'DEBUG',
        'OAUTHLIB_INSECURE_TRANSPORT': process.env.OAUTHLIB_INSECURE_TRANSPORT || '1'
      },
      enabled: true,
      tier: 'complete',
      tools: [
        'gmail', 'drive', 'calendar', 'sheets', 'slides', 
        'forms', 'tasks', 'chat', 'search', 'docs'
      ]
    };

    // Future MCP servers can be added here
    // Example: Slack, Notion, GitHub, etc.

    this.config = {
      servers,
      defaultServers: Object.keys(servers).filter(id => servers[id].enabled),
      serverManager: false // Use minimal constructor pattern
    };

    console.log(`[MCP] Built configuration with ${Object.keys(servers).length} servers:`, Object.keys(servers));
    return this.config;
  }

  /**
   * Create MCP client from configuration
   */
  async createMCPClient(settings: SettingsState): Promise<MCPClient> {
    const config = this.buildMCPConfig(settings);
    
    // Convert to mcp-use format
    const mcpUseConfig = {
      mcpServers: Object.fromEntries(
        Object.entries(config.servers)
          .filter(([_, server]) => server.enabled)
          .map(([id, server]) => [
            id,
            (
              (process.env.GOOGLE_MCP_TRANSPORT || '').toLowerCase() === 'http'
                ? { transport: 'http' as const, url: 'http://127.0.0.1:8000/mcp', env: server.env }
                : { command: server.command, args: server.args, env: server.env }
            )
          ])
      )
    } as const;

    console.log(`[MCP] Creating client with config:`, JSON.stringify(mcpUseConfig, null, 2));
    
    try {
      // Use the official MCPClient.fromDict pattern from the docs
      // Even with empty mcpServers, this should work
      const client = MCPClient.fromDict(mcpUseConfig);
      console.log(`[MCP] Client created successfully`);
      return client;
    } catch (error) {
      console.error(`[MCP] Failed to create client:`, error);
      // If MCP client creation fails, we'll fall back to direct LLM
      // Don't throw the error, just log it and return a null client
      console.log(`[MCP] MCP client creation failed, will use direct LLM fallback`);
      return null as any; // This will be handled in the SmartMCPAgent
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): MCPConfiguration | null {
    return this.config;
  }

  /**
   * Check if Google Workspace is available
   */
  isGoogleWorkspaceAvailable(settings: SettingsState): boolean {
    return settings.googleConnected && 
           !!(settings.googleOAuthClientId || process.env.GOOGLE_OAUTH_CLIENT_ID);
  }

  /**
   * Get available tools for current configuration
   */
  getAvailableTools(settings: SettingsState): string[] {
    const config = this.buildMCPConfig(settings);
    const tools: string[] = [];
    
    Object.values(config.servers).forEach(server => {
      if (server.enabled && server.tools) {
        tools.push(...server.tools);
      }
    });
    
    return [...new Set(tools)]; // Remove duplicates
  }
}
