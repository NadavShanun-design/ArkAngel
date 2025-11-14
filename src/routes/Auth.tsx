import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AuthForm } from '@/components/auth/AuthForm';
import { OnboardingPage } from '@/components/auth/OnboardingPage';
import { listen } from '@tauri-apps/api/event';

const AuthWindowContent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Listen for successful authentication
  useEffect(() => {
    const unlisten = listen('auth-success', () => {
      console.log('[Auth] auth-success event received');
      // Show onboarding instead of closing window
      setShowOnboarding(true);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  // Check if user is authenticated and needs onboarding
  useEffect(() => {
    console.log('[Auth] useEffect triggered:', { isAuthenticated, user, role: user?.role, showOnboarding });

    if (isAuthenticated && user) {
      if (!user.role) {
        // User has no role - show onboarding
        console.log('[Auth] User authenticated but no role, showing onboarding');
        setShowOnboarding(true);
      } else {
        // User has a role - close window
        console.log('[Auth] User authenticated with role:', user.role, '- closing window');
        invoke('close_auth_window').catch(console.error);
      }
    }
  }, [isAuthenticated, user, user?.role]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {showOnboarding && isAuthenticated ? (
          <OnboardingPage />
        ) : (
          <AuthForm />
        )}
      </div>
    </div>
  );
};

export const Auth: React.FC = () => {
  return (
    <AuthProvider>
      <AuthWindowContent />
    </AuthProvider>
  );
};
