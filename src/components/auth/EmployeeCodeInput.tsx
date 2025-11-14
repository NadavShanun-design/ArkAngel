import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { KeyRound, Loader2, Check, X } from 'lucide-react';

interface EmployeeCodeInputProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (employerName: string) => void;
}

export const EmployeeCodeInput: React.FC<EmployeeCodeInputProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { linkAsEmployee } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate code format (EMP-XXXXXX)
    const codeRegex = /^EMP-[A-Z0-9]{6}$/;
    if (!codeRegex.test(code.toUpperCase())) {
      setError('Invalid code format. Code should be in format: EMP-XXXXXX');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await linkAsEmployee(code.toUpperCase());

      if (result.success) {
        onSuccess(result.employer_name);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to link to employer. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCode = (value: string) => {
    // Remove any non-alphanumeric characters
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Add EMP- prefix if not present
    if (cleaned.length === 0) return '';
    if (cleaned.startsWith('EMP')) {
      // If user typed EMP, format as EMP-XXXXXX
      if (cleaned.length <= 3) return 'EMP-';
      return 'EMP-' + cleaned.slice(3, 9);
    }
    // If user didn't type EMP, assume they're typing the code part
    return 'EMP-' + cleaned.slice(0, 6);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 border border-zinc-200 dark:border-zinc-800">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          disabled={loading}
        >
          <X size={24} />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <KeyRound className="text-blue-600 dark:text-blue-400" size={32} />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            Join Your Organization
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Enter the employer code provided by your manager
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Code Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Employer Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(formatCode(e.target.value))}
              placeholder="EMP-XXXXXX"
              className="w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-wider bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
              disabled={loading}
              maxLength={10}
              autoComplete="off"
              autoFocus
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
              Format: EMP-XXXXXX (e.g., EMP-A1B2C3)
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-800 dark:text-red-200">
                {error}
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Your employer should have provided you with a unique code.
              If you don't have it, please contact your manager.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || code.length < 10}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Connecting...
              </>
            ) : (
              <>
                <Check size={20} />
                Join Organization
              </>
            )}
          </button>

          {/* Cancel Button */}
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};
