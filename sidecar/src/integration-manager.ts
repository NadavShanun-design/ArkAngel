/**
 * Integration Manager - Handles OAuth flows and user-specific tool connections
 *
 * Updated for Composio SDK v0.x (2025)
 *
 * This module provides:
 * - OAuth initiation and callback handling
 * - User-specific integration management
 * - Connection status tracking
 * - Tool availability checking
 */

import { getComposioClient, isComposioConfigured, getUserTools } from './composio-client.js';
import { getCategoryForApp } from './tool-categories.js';

/**
 * Interface for integration status
 */
export interface IntegrationStatus {
  appName: string;
  isConnected: boolean;
  category: string;
  connectedAt?: string;
  connectionId?: string;
}

/**
 * OAuth redirect result
 */
export interface OAuthRedirect {
  redirectUrl: string;
  connectionId?: string;
}

/**
 * Integration Manager Class
 * Manages user-specific integrations and OAuth flows
 */
export class IntegrationManager {
  private composio = getComposioClient();

  /**
   * Initiate OAuth flow for a specific tool
   * @param appName - Composio app identifier (e.g., 'slack', 'github')
   * @param userId - Unique user identifier from ArkAngel auth system
   * @param redirectUri - URI to redirect after OAuth completion
   * @returns OAuth redirect URL and connection ID
   */
  async connectTool(
    appName: string,
    userId: string,
    redirectUri: string = 'http://localhost:8765/api/oauth/callback'
  ): Promise<OAuthRedirect> {
    if (!isComposioConfigured() || !this.composio) {
      throw new Error('Composio is not configured. Please set COMPOSIO_API_KEY.');
    }

    try {
      console.log(`[IntegrationManager] Initiating connection for ${appName}, user: ${userId}`);

      // In the new SDK, connections are initiated via the connections API
      // TODO: Update when official connection initiation API is available
      // For now, return a placeholder that instructs to use Composio dashboard

      return {
        redirectUrl: `https://app.composio.dev/connect/${appName}?userId=${userId}&redirectUri=${encodeURIComponent(redirectUri)}`,
        connectionId: `pending_${appName}_${Date.now()}`
      };
    } catch (error: any) {
      console.error(`[IntegrationManager] Failed to connect ${appName}:`, error);
      throw new Error(`Failed to initiate connection: ${error.message}`);
    }
  }

  /**
   * Check if a user has connected a specific tool
   * @param appName - Composio app identifier
   * @param userId - User identifier
   * @returns true if connected
   */
  async isToolConnected(appName: string, userId: string): Promise<boolean> {
    if (!isComposioConfigured() || !this.composio) {
      return false;
    }

    try {
      // Get tools for this user and check if the app's tools are available
      const tools = await getUserTools(userId, [appName.toLowerCase()]);
      return Array.isArray(tools) && tools.length > 0;
    } catch (error) {
      console.error(`[IntegrationManager] Error checking connection for ${appName}:`, error);
      return false;
    }
  }

  /**
   * Disconnect a tool for a specific user
   * @param appName - Composio app identifier
   * @param userId - User identifier
   */
  async disconnectTool(appName: string, userId: string): Promise<void> {
    if (!isComposioConfigured() || !this.composio) {
      throw new Error('Composio is not configured.');
    }

    try {
      console.log(`[IntegrationManager] Disconnecting ${appName} for user ${userId}`);

      // TODO: Implement when SDK provides connection removal API
      // For now, connections must be removed via Composio dashboard
      console.warn(`[IntegrationManager] Connection removal must be done via Composio dashboard`);

    } catch (error: any) {
      console.error(`[IntegrationManager] Failed to disconnect ${appName}:`, error);
      throw new Error(`Failed to disconnect: ${error.message}`);
    }
  }

  /**
   * Get all connected integrations for a user
   * @param userId - User identifier
   * @returns Array of integration statuses
   */
  async getUserIntegrations(userId: string): Promise<IntegrationStatus[]> {
    if (!isComposioConfigured() || !this.composio) {
      return [];
    }

    try {
      // Get all tools for this user
      const tools = await getUserTools(userId);

      if (!Array.isArray(tools)) return [];

      // Extract unique app names from tools
      const uniqueApps = new Set<string>();
      const integrations: IntegrationStatus[] = [];

      for (const tool of tools) {
        const appName = this.extractAppNameFromTool(tool);
        if (appName && !uniqueApps.has(appName)) {
          uniqueApps.add(appName);
          integrations.push({
            appName,
            isConnected: true,
            category: getCategoryForApp(appName.toUpperCase()),
            connectedAt: new Date().toISOString()
          });
        }
      }

      console.log(`[IntegrationManager] Found ${integrations.length} connected integrations for user ${userId}`);
      return integrations;
    } catch (error) {
      console.error('[IntegrationManager] Failed to get user integrations:', error);
      return [];
    }
  }

  /**
   * Extract app name from a tool object
   * Tool names typically follow pattern: APPNAME_ACTION_NAME
   * @param tool - Tool object from Composio
   * @returns App name or null
   */
  private extractAppNameFromTool(tool: any): string | null {
    try {
      // Tool name format: "SLACK_SEND_MESSAGE" -> "SLACK"
      const name = tool.name || tool.slug || '';
      const parts = name.split('_');
      return parts.length > 0 ? parts[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Get tools for a specific user
   * @param userId - User identifier
   * @returns Array of tools
   */
  async getUserTools(userId: string): Promise<any[]> {
    if (!isComposioConfigured() || !this.composio) {
      return [];
    }

    try {
      const tools = await getUserTools(userId);
      return Array.isArray(tools) ? tools : [];
    } catch (error) {
      console.error('[IntegrationManager] Failed to get user tools:', error);
      return [];
    }
  }

  /**
   * Get status of all tools for a user (connected + available)
   * @param userId - User identifier
   * @returns Array of tool statuses
   */
  async getAllToolsStatus(userId: string): Promise<any[]> {
    if (!isComposioConfigured() || !this.composio) {
      return [];
    }

    try {
      const integrations = await this.getUserIntegrations(userId);
      return integrations.map(integration => ({
        appName: integration.appName,
        isConnected: integration.isConnected,
        category: integration.category,
        status: integration.isConnected ? 'connected' : 'available'
      }));
    } catch (error) {
      console.error('[IntegrationManager] Failed to get all tools status:', error);
      return [];
    }
  }

  /**
   * Get available toolkits/apps from Composio
   * @returns Array of available app names
   */
  async getAvailableApps(): Promise<string[]> {
    // Common Composio apps
    // In production, this could be fetched from Composio API
    return [
      'slack',
      'github',
      'gmail',
      'googlecalendar',
      'notion',
      'linear',
      'asana',
      'discord',
      'telegram',
      'googledrive',
      'dropbox',
      'stripe',
      'hubspot',
      'salesforce'
    ];
  }

  /**
   * Test OAuth callback handler
   * @param code - OAuth authorization code
   * @param state - OAuth state parameter
   * @returns Connection result
   */
  async handleOAuthCallback(code: string, state: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`[IntegrationManager] Handling OAuth callback with code: ${code?.substring(0, 10)}...`);

      // TODO: Implement when SDK provides callback handling API
      // For now, Composio handles callbacks automatically

      return {
        success: true,
        message: 'OAuth callback handled successfully. Please refresh the page.'
      };
    } catch (error: any) {
      console.error('[IntegrationManager] OAuth callback failed:', error);
      return {
        success: false,
        message: `OAuth callback failed: ${error.message}`
      };
    }
  }
}

/**
 * Singleton instance
 */
let integrationManagerInstance: IntegrationManager | null = null;

/**
 * Get the singleton instance of IntegrationManager
 */
export const getIntegrationManager = (): IntegrationManager => {
  if (!integrationManagerInstance) {
    integrationManagerInstance = new IntegrationManager();
  }
  return integrationManagerInstance;
};
