/**
 * User Helper - Get current user information
 *
 * Helper functions to retrieve the currently authenticated user
 * Used by integrations and other parts of the app
 */

/**
 * Get the current user ID from auth context or localStorage
 * Falls back to 'guest' if no user is authenticated
 */
export const getCurrentUserId = (): string => {
  // Try to get from localStorage (set by AuthContext)
  try {
    const authData = localStorage.getItem('auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed.user?.id) {
        return parsed.user.id;
      }
    }
  } catch (error) {
    console.warn('[UserHelper] Failed to parse auth data:', error);
  }

  // Fallback to guest
  return 'guest';
};

/**
 * Check if user is authenticated (not guest)
 */
export const isUserAuthenticated = (): boolean => {
  return getCurrentUserId() !== 'guest';
};

/**
 * Get current user email if available
 */
export const getCurrentUserEmail = (): string | null => {
  try {
    const authData = localStorage.getItem('auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      return parsed.user?.email || null;
    }
  } catch (error) {
    console.warn('[UserHelper] Failed to parse auth data:', error);
  }
  return null;
};
