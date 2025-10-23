import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, User } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  const handleGoToProfile = () => {
    window.location.href = '/profile';
  };

  const handleGoToLogin = () => {
    window.location.href = '/login';
  };

  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">Welcome back!</CardTitle>
            <CardDescription>
              Hello {user.full_name || 'there'}, you're already signed in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl font-medium">
                  {user.full_name?.[0] || user.email[0]}
                </span>
              </div>
              <h3 className="font-medium">{user.full_name || 'User'}</h3>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            <Button onClick={handleGoToProfile} className="w-full">
              <User className="w-4 h-4 mr-2" />
              Go to Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-900">ArkAngel</CardTitle>
          <CardDescription className="text-lg">
            Your AI Assistant with Personal Profile Management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-gray-600">
            <p className="mb-4">
              Sign in to access your personal profile, manage your AI personas, and customize your experience.
            </p>
          </div>
          <Button onClick={handleGoToLogin} className="w-full">
            <LogIn className="w-4 h-4 mr-2" />
            Sign In / Sign Up
          </Button>
          <div className="text-center text-xs text-gray-500">
            <p>Click "Open Profile" in the desktop app settings to access your profile page</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
