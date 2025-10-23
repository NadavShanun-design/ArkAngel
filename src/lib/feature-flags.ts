/**
 * Feature Flags - Frontend feature toggles
 *
 * Controls which features are enabled in the React frontend
 */

/**
 * Use Composio for API integrations
 * Can be controlled via localStorage for easy testing
 */
export const isComposioEnabled = (): boolean => {
  // Check localStorage first (for easy testing)
  const localStorageFlag = localStorage.getItem('use_composio');
  if (localStorageFlag !== null) {
    return localStorageFlag === 'true';
  }

  // Check environment variable (set at build time)
  if (import.meta.env.VITE_USE_COMPOSIO !== undefined) {
    return import.meta.env.VITE_USE_COMPOSIO === 'true';
  }

  // Default: disabled (use legacy MCP-use)
  return false;
};

/**
 * Get the appropriate chat endpoint URL
 */
export const getChatEndpoint = (): string => {
  const baseUrl = 'http://127.0.0.1:8765';
  return isComposioEnabled()
    ? `${baseUrl}/api/chat/composio/stream`
    : `${baseUrl}/api/chat/stream`;
};

/**
 * Enable Composio (saves to localStorage)
 */
export const enableComposio = (): void => {
  localStorage.setItem('use_composio', 'true');
  console.log('[Feature Flags] Composio enabled');
};

/**
 * Disable Composio (saves to localStorage)
 */
export const disableComposio = (): void => {
  localStorage.setItem('use_composio', 'false');
  console.log('[Feature Flags] Composio disabled');
};

/**
 * Toggle Composio feature
 */
export const toggleComposio = (): boolean => {
  const newState = !isComposioEnabled();
  localStorage.setItem('use_composio', String(newState));
  console.log(`[Feature Flags] Composio ${newState ? 'enabled' : 'disabled'}`);
  return newState;
};

/**
 * Get all feature flags status
 */
export const getFeatureFlagsStatus = () => {
  return {
    composioEnabled: isComposioEnabled(),
    chatEndpoint: getChatEndpoint()
  };
};

/**
 * Log feature flags on app startup
 */
export const logFeatureFlags = (): void => {
  console.log('[Feature Flags] Frontend status:');
  console.log(`  Composio: ${isComposioEnabled() ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`  Chat Endpoint: ${getChatEndpoint()}`);
};

// Auto-log on module load
logFeatureFlags();
