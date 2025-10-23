/**
 * Feature Flags - Control rollout of new features
 *
 * This module provides feature flags for gradual rollout of Composio integration
 * alongside the existing MCP-use system.
 */

/**
 * Use Composio for API integrations instead of mcp-use
 * Set to 'true' to enable Composio, 'false' to use legacy MCP-use
 */
export const USE_COMPOSIO = process.env.USE_COMPOSIO === 'true';

/**
 * Fall back to MCP-use if Composio fails
 * If true, errors in Composio will fall back to MCP-use Google Workspace
 */
export const COMPOSIO_FALLBACK_TO_MCP = process.env.COMPOSIO_FALLBACK === 'true' || true; // Default true for safety

/**
 * Enable verbose logging for Composio operations
 */
export const COMPOSIO_DEBUG = process.env.COMPOSIO_DEBUG === 'true';

/**
 * Check if Composio is enabled
 */
export const isComposioEnabled = (): boolean => {
  return USE_COMPOSIO;
};

/**
 * Check if fallback is enabled
 */
export const isFallbackEnabled = (): boolean => {
  return COMPOSIO_FALLBACK_TO_MCP;
};

/**
 * Log feature flag status on startup
 */
export const logFeatureFlags = (): void => {
  console.log('[Feature Flags] Status:');
  console.log(`  USE_COMPOSIO: ${USE_COMPOSIO ? '✅ Enabled' : '❌ Disabled (using MCP-use)'}`);
  console.log(`  COMPOSIO_FALLBACK: ${COMPOSIO_FALLBACK_TO_MCP ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`  COMPOSIO_DEBUG: ${COMPOSIO_DEBUG ? '✅ Enabled' : '❌ Disabled'}`);
};

/**
 * Get the appropriate chat endpoint based on feature flags
 */
export const getChatEndpoint = (): string => {
  return USE_COMPOSIO ? '/api/chat/composio/stream' : '/api/chat/stream';
};
