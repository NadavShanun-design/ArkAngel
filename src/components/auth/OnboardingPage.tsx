import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleSelectionModal } from './RoleSelectionModal';
import { EmployerCodeDisplay } from './EmployerCodeDisplay';
import { EmployeeCodeInput } from './EmployeeCodeInput';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

type OnboardingStep =
  | 'role-selection'
  | 'employer-org-name'
  | 'employer-code-display'
  | 'employee-code-input'
  | 'complete';

export const OnboardingPage: React.FC = () => {
  const { user, setupAsEmployer } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('role-selection');
  const [organizationName, setOrganizationName] = useState('');
  const [employerCode, setEmployerCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle role selection
  const handleRoleSelected = async (role: 'employer' | 'employee') => {
    console.log('[OnboardingPage] ===== ROLE SELECTED =====');
    console.log('[OnboardingPage] Selected role:', role);
    console.log('[OnboardingPage] Current user:', user);

    if (role === 'employer') {
      // Check if user is guest (no email)
      const isGuest = !user?.email;
      console.log('[OnboardingPage] Is guest user:', isGuest);

      if (isGuest) {
        // Auto-generate org name and create employer account immediately for guests
        console.log('[OnboardingPage] Guest user detected, auto-generating organization');
        setLoading(true);
        setError(null);
        try {
          console.log('[OnboardingPage] Calling setupAsEmployer("")...');
          const result = await setupAsEmployer('');  // Empty string = auto-generate
          console.log('[OnboardingPage] ✅ Setup employer SUCCESS! Result:', result);
          console.log('[OnboardingPage] Employer code:', result.employer_code);
          console.log('[OnboardingPage] Organization ID:', result.organization_id);

          setEmployerCode(result.employer_code);
          setCurrentStep('employer-code-display');
        } catch (err: any) {
          console.error('[OnboardingPage] ❌ Setup employer FAILED!');
          console.error('[OnboardingPage] Error:', err);
          console.error('[OnboardingPage] Error message:', err.message);
          console.error('[OnboardingPage] Error stack:', err.stack);

          setError(err.message || 'Failed to create organization');
        } finally {
          setLoading(false);
        }
      } else {
        // Regular user: ask for org name
        console.log('[OnboardingPage] Regular user: showing org name input');
        setCurrentStep('employer-org-name');
      }
    } else {
      // Show employee code input
      console.log('[OnboardingPage] Employee role: showing code input');
      setCurrentStep('employee-code-input');
    }
  };

  // Handle employer organization setup
  const handleOrganizationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationName.trim()) {
      setError('Please enter an organization name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await setupAsEmployer(organizationName.trim());
      setEmployerCode(result.employer_code);
      // Organization ID is stored in user context, no need to store locally
      setCurrentStep('employer-code-display');
    } catch (err: any) {
      setError(err.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  // Handle employer continuing to dashboard
  const handleEmployerContinue = () => {
    console.log('[OnboardingPage] Employer setup complete, closing auth window');
    // Close the auth window - the main app will handle navigation
    invoke('close_auth_window').catch(console.error);
  };

  // Handle employee successful linking
  const handleEmployeeSuccess = (_employerName: string) => {
    console.log('[OnboardingPage] Employee linked successfully, closing auth window');
    // Close the auth window - the main app will handle navigation
    invoke('close_auth_window').catch(console.error);
  };

  // Render based on current step
  return (
    <>
      {/* Role Selection Modal */}
      {currentStep === 'role-selection' && (
        <RoleSelectionModal
          isOpen={true}
          onClose={() => {}} // Prevent closing during onboarding
          onRoleSelected={handleRoleSelected}
        />
      )}

      {/* Employer Organization Name Input */}
      {currentStep === 'employer-org-name' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <Building2 className="text-purple-600 dark:text-purple-400" size={32} />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Create Your Organization</CardTitle>
              <CardDescription>
                Enter your organization name to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleOrganizationSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="org-name" className="text-sm font-medium">
                    Organization Name
                  </Label>
                  <Input
                    id="org-name"
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="e.g., Acme Corporation"
                    className="text-lg"
                    autoFocus
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be shown to your employees
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      {error}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={loading || !organizationName.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={20} />
                      Creating Organization...
                    </>
                  ) : (
                    'Create Organization'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Employer Code Display */}
      {currentStep === 'employer-code-display' && employerCode && (
        <EmployerCodeDisplay
          employerCode={employerCode}
          organizationName={organizationName}
          onContinue={handleEmployerContinue}
        />
      )}

      {/* Employee Code Input */}
      {currentStep === 'employee-code-input' && (
        <EmployeeCodeInput
          isOpen={true}
          onClose={() => {}} // Prevent closing during onboarding
          onSuccess={handleEmployeeSuccess}
        />
      )}
    </>
  );
};
