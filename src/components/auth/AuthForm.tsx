import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react';
import { emit } from '@tauri-apps/api/event';

export const AuthForm: React.FC = () => {
  const { login, register, isLoading, error, clearError } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [signInSuccess, setSignInSuccess] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
  });

  // Reset form state when component mounts or becomes visible
  // This ensures each time the auth window opens, it's a fresh start
  useEffect(() => {
    const resetFormState = () => {
      setEmailSent(false);
      setSignInSuccess(false);
      setIsSignUp(false);
      setShowPassword(false);
      setFormData({
        email: '',
        password: '',
        full_name: '',
        phone: '',
      });
      clearError(); // Clear any auth errors
    };

    // Reset on mount
    resetFormState();

    // Also listen for visibility changes (when window is focused)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetFormState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isSignUp) {
        await register(formData.email, formData.password, {
          full_name: formData.full_name,
          phone: formData.phone,
        });
        // Show email confirmation message
        setEmailSent(true);
      } else {
        await login(formData.email, formData.password);
        // Show success confirmation
        setSignInSuccess(true);
        // Wait 1.5 seconds, then close the window
        setTimeout(() => {
          emit('auth-success');
        }, 1500);
      }
    } catch (error) {
      // Error is handled by the auth context
      console.error('Authentication error:', error);
    }
  };

  const handleGuestSignIn = () => {
    // For guest mode, just close the auth window without logging in
    // The app will continue in guest mode
    emit('auth-success');
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* ArkAngel Logo */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-black rounded-xl flex items-center justify-center shadow-md">
          <span className="text-2xl font-bold text-white">A</span>
        </div>
        <h1 className="text-2xl font-bold text-black">ArkAngel</h1>
        <p className="text-gray-500 mt-2">Sign in to your account</p>
      </div>

      {signInSuccess ? (
        <Card className="shadow-lg border border-gray-200 bg-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold text-center text-green-600">
              Signed In Successfully!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <Mail className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 text-center">
                You have been signed in successfully. Welcome back!
              </AlertDescription>
            </Alert>
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-black" />
            </div>
          </CardContent>
        </Card>
      ) : emailSent ? (
        <Card className="shadow-lg border border-gray-200 bg-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold text-center text-green-600">
              Check Your Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <Mail className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                We've sent a confirmation email to <strong>{formData.email}</strong>.
                Please click the link in the email to verify your account and complete signup.
              </AlertDescription>
            </Alert>
            <p className="text-sm text-gray-500 text-center">
              After confirming your email, you can sign in and start using ArkAngel!
            </p>
            <Button
              onClick={() => {
                setEmailSent(false);
                setIsSignUp(false);
              }}
              variant="outline"
              className="w-full border-gray-300 text-black hover:bg-gray-100"
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg border border-gray-200 bg-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold text-center text-black">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </CardTitle>
            <CardDescription className="text-center text-gray-500">
              {isSignUp
                ? 'Enter your details to create your ArkAngel account'
                : 'Enter your email and password to sign in'
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-black">
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="pl-10 border-gray-300 focus:border-black focus:ring-black"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-black">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="pl-10 pr-10 border-gray-300 focus:border-black focus:ring-black"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-black"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Sign Up Additional Fields */}
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-sm font-medium text-black">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="full_name"
                      name="full_name"
                      type="text"
                      placeholder="Enter your full name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      className="pl-10 border-gray-300 focus:border-black focus:ring-black"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-black">
                    Phone Number (Optional)
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="Enter your phone number"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="pl-10 border-gray-300 focus:border-black focus:ring-black"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-black text-white hover:bg-gray-800"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignUp ? 'Creating account...' : 'Signing in...'}
                </>
              ) : (
                isSignUp ? 'Create account' : 'Sign in'
              )}
            </Button>
          </form>

          {/* Toggle between Sign In and Sign Up */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-black hover:text-gray-600 font-medium underline underline-offset-2"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"
              }
            </button>
          </div>

          {/* Guest Sign In */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue as</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-gray-300 text-black hover:bg-gray-100"
            onClick={handleGuestSignIn}
            disabled={isLoading}
          >
            Guest User
          </Button>
        </CardContent>
      </Card>
      )}

      {/* Footer */}
      <div className="text-center mt-6">
        <p className="text-xs text-gray-500">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};
