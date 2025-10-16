import React, { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthForm } from '@/components/auth/AuthForm';
import { listen } from '@tauri-apps/api/event';

const AuthWindowContent: React.FC = () => {
  useEffect(() => {
    const unlisten = listen('auth-success', () => {
      invoke('close_auth_window').catch(console.error);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AuthForm />
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
