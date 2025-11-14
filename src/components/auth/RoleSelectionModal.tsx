import React, { useState } from 'react';
import { Building2, User, X, Loader2 } from 'lucide-react';

interface RoleSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoleSelected: (role: 'employer' | 'employee') => void;
}

export const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({
  isOpen,
  onClose,
  onRoleSelected,
}) => {
  const [selectedRole, setSelectedRole] = useState<'employer' | 'employee' | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleRoleSelect = async (role: 'employer' | 'employee') => {
    setSelectedRole(role);
    setLoading(true);

    try {
      onRoleSelected(role);
    } catch (error) {
      console.error('Failed to set role:', error);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-8 border border-zinc-200 dark:border-zinc-800">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          disabled={loading}
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
            Welcome to ArkAngel
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Choose your role to get started
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Employer Card */}
          <button
            onClick={() => handleRoleSelect('employer')}
            disabled={loading}
            className={`group relative p-8 rounded-xl border-2 transition-all ${
              loading
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:scale-105 hover:shadow-xl cursor-pointer'
            } ${
              selectedRole === 'employer'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : 'border-zinc-200 dark:border-zinc-700 hover:border-purple-400'
            }`}
          >
            {loading && selectedRole === 'employer' && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-zinc-900/50 rounded-xl">
                <Loader2 className="animate-spin text-purple-500" size={32} />
              </div>
            )}

            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`p-4 rounded-full ${
                selectedRole === 'employer'
                  ? 'bg-purple-100 dark:bg-purple-900/40'
                  : 'bg-zinc-100 dark:bg-zinc-800 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40'
              } transition-colors`}>
                <Building2 className={`${
                  selectedRole === 'employer'
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-zinc-600 dark:text-zinc-400 group-hover:text-purple-600 dark:group-hover:text-purple-400'
                } transition-colors`} size={48} />
              </div>

              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                  I'm an Employer
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Manage employees and view their productivity analytics
                </p>
              </div>

              <ul className="text-xs text-left text-zinc-500 dark:text-zinc-500 space-y-2 w-full">
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Get unique employer code</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>View all employee analytics</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Real-time monitoring</span>
                </li>
              </ul>
            </div>
          </button>

          {/* Employee Card */}
          <button
            onClick={() => handleRoleSelect('employee')}
            disabled={loading}
            className={`group relative p-8 rounded-xl border-2 transition-all ${
              loading
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:scale-105 hover:shadow-xl cursor-pointer'
            } ${
              selectedRole === 'employee'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-zinc-200 dark:border-zinc-700 hover:border-blue-400'
            }`}
          >
            {loading && selectedRole === 'employee' && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-zinc-900/50 rounded-xl">
                <Loader2 className="animate-spin text-blue-500" size={32} />
              </div>
            )}

            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`p-4 rounded-full ${
                selectedRole === 'employee'
                  ? 'bg-blue-100 dark:bg-blue-900/40'
                  : 'bg-zinc-100 dark:bg-zinc-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40'
              } transition-colors`}>
                <User className={`${
                  selectedRole === 'employee'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                } transition-colors`} size={48} />
              </div>

              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                  I'm an Employee
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Link to your employer and track your own performance
                </p>
              </div>

              <ul className="text-xs text-left text-zinc-500 dark:text-zinc-500 space-y-2 w-full">
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Enter employer code to join</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>View your own analytics</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Track your productivity</span>
                </li>
              </ul>
            </div>
          </button>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            You can change your role later in settings
          </p>
        </div>
      </div>
    </div>
  );
};
