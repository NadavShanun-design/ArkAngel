import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { signUp, signIn, signOut, getCurrentUser, onAuthStateChange, getProfile, updateProfile } from '@/lib/supabase';

interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  design_accent?: string;
  design_gradient?: string;
  current_persona_id?: string;
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
  register: (email: string, password: string, userData?: { full_name?: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: {
    full_name?: string;
    phone?: string;
    avatar_url?: string;
    design_accent?: string;
    design_gradient?: string;
    current_persona_id?: string;
  }) => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
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

  // Initialize auth state and listen for changes
  useEffect(() => {
    const initializeAuth = async () => {
      // Set loading state during initialization
      setAuthState(prev => ({ ...prev, isLoading: true }));

      try {
        // Get initial user
        const user = await getCurrentUser();
        if (user) {
          // Get user profile
          const profile = await getProfile(user.id);
          setAuthState({
            user: profile,
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
      console.log('Auth state changed:', event, session);
      
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const profile = await getProfile(session.user.id);
          setAuthState({
            user: profile,
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
        } catch (error) {
          console.error('Failed to get profile after sign in:', error);
          setAuthState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Failed to load user profile',
          }));
        }
      } else if (event === 'SIGNED_OUT') {
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
    try {
      await signOut();
      // Auth state change listener will handle the rest
    } catch (error: any) {
      console.error('Logout error:', error);
      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Failed to logout',
      }));
    }
  };

  const updateUserProfile = async (updates: {
    full_name?: string;
    phone?: string;
    avatar_url?: string;
    design_accent?: string;
    design_gradient?: string;
    current_persona_id?: string;
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

  const clearError = () => {
    setAuthState(prev => ({ ...prev, error: null }));
  };

  const value: AuthContextType = {
    ...authState,
    login,
    register,
    logout,
    updateUserProfile,
    refreshUser,
    clearError,
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