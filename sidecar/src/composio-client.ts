/**
 * Composio Client - Central client for managing Composio API connections
 *
 * This module provides a singleton Composio client instance that handles:
 * - API authentication
 * - Tool discovery and management
 * - Integration connectivity status
 *
 * Using NEW Composio SDK v0.x API (2025)
 */

import { Composio } from '@composio/core';

// Singleton instance
let composioClient: Composio | null = null;

/**
 * Get or create the Composio client instance
 * @returns Composio client configured with API key from environment
 */
export const getComposioClient = (): Composio | null => {
  if (!composioClient) {
    const apiKey = process.env.COMPOSIO_API_KEY;

    if (!apiKey) {
      console.warn('[Composio] No API key found. Set COMPOSIO_API_KEY in .env file.');
      console.warn('[Composio] Operating in limited mode - integrations will not work.');
      return null;
    }

    composioClient = new Composio({
      apiKey: apiKey
    });

    console.log('[Composio] Client initialized successfully');
  }

  return composioClient;
};

/**
 * Check if Composio is properly configured
 * @returns true if API key is present
 */
export const isComposioConfigured = (): boolean => {
  return Boolean(process.env.COMPOSIO_API_KEY);
};

/**
 * Get list of tools for a specific user
 * Uses new SDK v0.x API: composio.tools.get(userId, options)
 * @param userId - User identifier
 * @param toolkits - Optional array of toolkit names (e.g., ['slack', 'github'])
 * @returns Array of available tools
 */
export const getUserTools = async (userId: string, toolkits?: string[]) => {
  try {
    const client = getComposioClient();
    if (!client) return [];

    // If toolkits provided, filter by them; otherwise get all tools
    let tools;
    if (toolkits && toolkits.length > 0) {
      tools = await client.tools.get(userId, { toolkits });
    } else {
      // Get all tools without filters - use empty toolkits array
      tools = await client.tools.get(userId, { toolkits: [] });
    }

    console.log(`[Composio] Found ${Array.isArray(tools) ? tools.length : 1} tools for user ${userId}`);
    return tools;
  } catch (error) {
    console.error('[Composio] Failed to fetch user tools:', error);
    return [];
  }
};

/**
 * Get a specific tool by name
 * @param userId - User identifier
 * @param toolName - Tool slug (e.g., 'SLACK_SEND_MESSAGE')
 * @returns The specific tool or null
 */
export const getSpecificTool = async (userId: string, toolName: string) => {
  try {
    const client = getComposioClient();
    if (!client) return null;

    const tool = await client.tools.get(userId, toolName);
    console.log(`[Composio] Retrieved tool: ${toolName}`);
    return tool;
  } catch (error) {
    console.error(`[Composio] Failed to fetch tool ${toolName}:`, error);
    return null;
  }
};

/**
 * Execute a tool action
 * @param userId - User identifier
 * @param toolName - Tool slug
 * @param params - Tool parameters
 * @returns Execution result
 */
export const executeTool = async (userId: string, toolName: string, params: any) => {
  try {
    const client = getComposioClient();
    if (!client) throw new Error('Composio client not initialized');

    // TODO: Update when execute API is available in SDK
    // For now, return a mock result
    console.warn(`[Composio] Execute not yet implemented for ${toolName}`);
    return {
      success: false,
      error: 'Tool execution not yet implemented in current SDK version'
    };
  } catch (error: any) {
    console.error(`[Composio] Tool execution failed:`, error);
    throw error;
  }
};

/**
 * Health check for Composio service
 * @returns true if Composio is accessible and configured
 */
export const healthCheck = async (): Promise<boolean> => {
  if (!isComposioConfigured()) {
    return false;
  }

  try {
    const client = getComposioClient();
    if (!client) return false;

    // Try to get tools for default user as a health check
    await client.tools.get('default', { toolkits: ['slack'] });
    return true;
  } catch (error) {
    console.error('[Composio] Health check failed:', error);
    return false;
  }
};

/**
 * Reset the client instance (useful for testing or reinitialization)
 */
export const resetClient = () => {
  composioClient = null;
  console.log('[Composio] Client instance reset');
};
