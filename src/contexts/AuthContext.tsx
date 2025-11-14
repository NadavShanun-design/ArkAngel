import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { signUp, signIn, signOut, getCurrentUser, onAuthStateChange, getProfile, updateProfile, setupEmployerAccount, linkEmployeeToOrganization, getUserOrganization, signInAsGuest, generateGuestUsername, supabase } from '@/lib/supabase';
import { invoke } from '@tauri-apps/api/core';

interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  website?: string;
  design_accent?: string;
  design_gradient?: string;
  current_persona_id?: string;
  theme?: string;
  subscription_tier?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: string;
  subscription_current_period_end?: string;
  // Multi-tenant fields
  role?: 'employer' | 'employee';
  organization_id?: string;
  employer_code?: string;
  // Guest user detection
  is_guest?: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  register: (email: string, password: string, userData?: { full_name?: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: {
    full_name?: string;
    phone?: string;
    avatar_url?: string;
    bio?: string;
    location?: string;
    website?: string;
    design_accent?: string;
    design_gradient?: string;
    current_persona_id?: string;
    theme?: string;
    subscription_tier?: string;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    subscription_status?: string;
    subscription_current_period_end?: string;
  }) => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  // Multi-tenant functions
  setupAsEmployer: (organizationName: string) => Promise<{ employer_code: string; organization_id: string }>;
  linkAsEmployee: (employerCode: string) => Promise<{ success: boolean; employer_name: string }>;
  refreshOrganization: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });

  // Sync user context to Tauri backend whenever user changes
  useEffect(() => {
    const syncUserContext = async () => {
      try {
        if (authState.user && authState.isAuthenticated) {
          // Sync user context to Rust backend
          await invoke('set_user_context', {
            userId: authState.user.id,
            organizationId: authState.user.organization_id || null,
            role: authState.user.role || null,
          });
          console.log('[AuthContext] Synced user context to Tauri backend');
        } else {
          // Clear user context on logout
          await invoke('clear_user_context');
          console.log('[AuthContext] Cleared user context from Tauri backend');
        }
      } catch (error) {
        console.error('[AuthContext] Failed to sync user context to Tauri:', error);
      }
    };

    syncUserContext();
  }, [authState.user, authState.isAuthenticated]);

  // Initialize auth state and listen for changes
  useEffect(() => {
    const initializeAuth = async () => {
      // Don't set loading state during initialization - this is background work
      // Only set isLoading when user explicitly clicks login/register buttons

      try {
        // Get initial user
        const user = await getCurrentUser();
        if (user) {
          // Get user profile
          const profile = await getProfile(user.id);

          // Detect if user is a guest (anonymous Supabase user)
          const isGuest = user.is_anonymous || false;

          setAuthState({
            user: { ...profile, is_guest: isGuest },
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Load user preferences from profile to localStorage
          if (profile.design_accent) {
            localStorage.setItem('design-accent', profile.design_accent);
            document.documentElement.dataset.accent = profile.design_accent;
          }
          if (profile.design_gradient) {
            localStorage.setItem('design-gradient', profile.design_gradient);
            document.documentElement.dataset.gradient = profile.design_gradient;
          }
          if (profile.current_persona_id) {
            const settings = JSON.parse(localStorage.getItem('chat-settings') || '{}');
            settings.currentPersonaId = profile.current_persona_id;
            localStorage.setItem('chat-settings', JSON.stringify(settings));
          }
        } else {
          // Guest mode - no error, just not authenticated
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        // Still allow guest mode on error
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] Auth state changed:', event, 'User:', session?.user?.id, 'Is Anonymous:', session?.user?.is_anonymous);

      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const userId = session.user.id;
          const isGuest = session.user.is_anonymous || false;

          // Try to get existing profile
          let profile;
          try {
            profile = await getProfile(userId);
            console.log('[AuthContext] Loaded existing profile:', profile);
          } catch (profileError: any) {
            console.log('[AuthContext] Profile not found, creating new profile for user:', userId);

            // Create profile for new user (works for both regular and anonymous users)
            const fakeName = isGuest ? generateGuestUsername() : 'User';

            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                email: session.user.email || null,
                full_name: fakeName,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (createError) {
              console.error('[AuthContext] Failed to create profile:', createError);
              throw new Error(`Failed to create profile: ${createError.message}`);
            }

            profile = newProfile;
            console.log('[AuthContext] Created new profile:', profile);
          }

          setAuthState({
            user: { ...profile, is_guest: isGuest },
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Load user preferences from profile to localStorage
          if (profile.design_accent) {
            localStorage.setItem('design-accent', profile.design_accent);
            document.documentElement.dataset.accent = profile.design_accent;
          }
          if (profile.design_gradient) {
            localStorage.setItem('design-gradient', profile.design_gradient);
            document.documentElement.dataset.gradient = profile.design_gradient;
          }
          if (profile.current_persona_id) {
            const settings = JSON.parse(localStorage.getItem('chat-settings') || '{}');
            settings.currentPersonaId = profile.current_persona_id;
            localStorage.setItem('chat-settings', JSON.stringify(settings));
          }

          console.log('[AuthContext] Sign-in complete, user authenticated');
        } catch (error: any) {
          console.error('[AuthContext] Failed to handle sign-in:', error);
          setAuthState(prev => ({
            ...prev,
            isLoading: false,
            error: error.message || 'Failed to load user profile',
          }));
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[AuthContext] User signed out');
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await signIn(email, password);
      // Auth state change listener will handle the rest
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Login failed. Please check your credentials.',
      }));
      throw error;
    }
  };

  const loginAsGuest = async () => {
    console.log('[AuthContext] loginAsGuest() called');
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Sign in anonymously with Supabase
      console.log('[AuthContext] Creating anonymous Supabase user...');
      const data = await signInAsGuest();

      // Check if we got a session and user
      if (!data || !data.user) {
        throw new Error('Failed to create guest user. Anonymous sign-ins may not be enabled in Supabase. Please contact support.');
      }

      const user = data.user;
      console.log('[AuthContext] Anonymous user created with ID:', user.id);
      console.log('[AuthContext] User is_anonymous:', user.is_anonymous);

      // The onAuthStateChange listener will handle creating the profile and updating state
      // We just need to wait for it to complete
      console.log('[AuthContext] Guest user created successfully, waiting for profile creation...');
    } catch (error: any) {
      console.error('[AuthContext] Guest login error:', error);
      const errorMessage = error.message || 'Guest login failed. Please try again.';

      // Provide helpful error messages
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('Anonymous sign-ins') || errorMessage.includes('anonymous')) {
        userFriendlyMessage = 'Guest login is currently unavailable. Please sign up with email or contact support.';
      }

      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: userFriendlyMessage,
      }));
      throw new Error(userFriendlyMessage);
    }
  };

  const register = async (email: string, password: string, userData?: { full_name?: string; phone?: string }) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await signUp(email, password, userData);
      // Auth state change listener will handle the rest
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Registration failed. Please try again.',
      }));
      throw error;
    }
  };

  const logout = async () => {
    console.log('[AuthContext] ===== LOGOUT FUNCTION CALLED =====');
    console.log('[AuthContext] Current user:', authState.user);
    console.log('[AuthContext] Current isAuthenticated:', authState.isAuthenticated);

    try {
      console.log('[AuthContext] Step 1: Calling Supabase signOut...');
      await signOut();
      console.log('[AuthContext] ✅ Step 1 COMPLETE: Supabase signOut completed');

      // Clear Tauri backend user context
      try {
        console.log('[AuthContext] Step 2: Clearing Tauri user context...');
        await invoke('clear_user_context');
        console.log('[AuthContext] ✅ Step 2 COMPLETE: Cleared Tauri user context');
      } catch (tauriError) {
        console.warn('[AuthContext] ⚠️ Step 2 WARNING: Failed to clear Tauri user context:', tauriError);
        // Continue anyway - this is not critical
      }

      // Immediately clear local state
      console.log('[AuthContext] Step 3: Clearing local auth state...');
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      console.log('[AuthContext] ✅ Step 3 COMPLETE: Auth state cleared');
      console.log('[AuthContext] ===== LOGOUT COMPLETED SUCCESSFULLY =====');
      // Auth state change listener will also handle the SIGNED_OUT event
    } catch (error: any) {
      console.error('[AuthContext] ===== LOGOUT ERROR =====');
      console.error('[AuthContext] Error object:', error);
      console.error('[AuthContext] Error message:', error.message);
      console.error('[AuthContext] Error stack:', error.stack);

      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Failed to logout',
      }));

      console.error('[AuthContext] ===== RE-THROWING ERROR =====');
      throw error; // Re-throw so caller knows it failed
    }
  };

  const updateUserProfile = async (updates: {
    full_name?: string;
    phone?: string;
    avatar_url?: string;
    bio?: string;
    location?: string;
    website?: string;
    design_accent?: string;
    design_gradient?: string;
    current_persona_id?: string;
    theme?: string;
    subscription_tier?: string;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    subscription_status?: string;
    subscription_current_period_end?: string;
  }) => {
    if (!authState.user) return;

    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const updatedProfile = await updateProfile(authState.user.id, updates);
      setAuthState(prev => ({
        ...prev,
        user: updatedProfile,
        isLoading: false,
        error: null,
      }));

      // If design preferences were updated, sync to localStorage immediately
      if (updates.design_accent) {
        localStorage.setItem('design-accent', updates.design_accent);
      }
      if (updates.design_gradient) {
        localStorage.setItem('design-gradient', updates.design_gradient);
      }
      if (updates.theme) {
        localStorage.setItem('theme', updates.theme);
      }
      if (updates.current_persona_id) {
        // Update current persona in settings
        const settings = JSON.parse(localStorage.getItem('chat-settings') || '{}');
        settings.currentPersonaId = updates.current_persona_id;
        localStorage.setItem('chat-settings', JSON.stringify(settings));
      }
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to update profile',
      }));
      throw error;
    }
  };

  const refreshUser = async () => {
    if (!authState.isAuthenticated) return;

    try {
      const user = await getCurrentUser();
      if (user) {
        const profile = await getProfile(user.id);
        setAuthState(prev => ({ ...prev, user: profile }));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  // Multi-tenant functions
  const setupAsEmployer = async (organizationName: string) => {
    if (!authState.user) {
      throw new Error('User must be authenticated to setup employer account');
    }

    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await setupEmployerAccount(authState.user.id, organizationName);

      // Update local user state with new role and organization
      setAuthState(prev => ({
        ...prev,
        user: prev.user ? {
          ...prev.user,
          role: 'employer',
          organization_id: result.organization_id,
          employer_code: result.employer_code,
        } : null,
        isLoading: false,
      }));

      return result;
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to setup employer account',
      }));
      throw error;
    }
  };

  const linkAsEmployee = async (employerCode: string) => {
    if (!authState.user) {
      throw new Error('User must be authenticated to link to employer');
    }

    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await linkEmployeeToOrganization(authState.user.id, employerCode);

      if (!result.success) {
        throw new Error('Invalid employer code');
      }

      // Update local user state with new role and organization
      setAuthState(prev => ({
        ...prev,
        user: prev.user ? {
          ...prev.user,
          role: 'employee',
          organization_id: result.organization_id,
        } : null,
        isLoading: false,
      }));

      return {
        success: true,
        employer_name: result.employer_name,
      };
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to link to employer',
      }));
      throw error;
    }
  };

  const refreshOrganization = async () => {
    if (!authState.user) return;

    try {
      const orgData = await getUserOrganization(authState.user.id);

      if (orgData) {
        setAuthState(prev => ({
          ...prev,
          user: prev.user ? {
            ...prev.user,
            role: orgData.user_role as 'employer' | 'employee',
            organization_id: orgData.id,
            employer_code: orgData.user_employer_code,
          } : null,
        }));
      }
    } catch (error) {
      console.error('Failed to refresh organization:', error);
    }
  };

  const value: AuthContextType = {
    ...authState,
    login,
    loginAsGuest,
    register,
    logout,
    updateUserProfile,
    refreshUser,
    clearError,
    setupAsEmployer,
    linkAsEmployee,
    refreshOrganization,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};