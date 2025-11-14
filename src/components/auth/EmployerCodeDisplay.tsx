import React, { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';

interface EmployerCodeDisplayProps {
  employerCode: string;
  organizationName: string;
  onContinue: () => void;
}

export const EmployerCodeDisplay: React.FC<EmployerCodeDisplayProps> = ({
  employerCode,
  organizationName,
  onContinue,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(employerCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 border border-zinc-200 dark:border-zinc-800">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <Check className="text-green-600 dark:text-green-400" size={32} />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            Employer Account Created!
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            {organizationName}
          </p>
        </div>

        {/* Employer Code Display */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Your Employer Code
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-4 border border-zinc-200 dark:border-zinc-700">
              <div className="text-3xl font-mono font-bold text-center tracking-wider text-zinc-900 dark:text-white">
                {employerCode}
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="p-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check size={24} /> : <Copy size={24} />}
            </button>
          </div>
          {copied && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2 text-center">
              Copied to clipboard!
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Share2 className="text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" size={20} />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Share this code with your employees
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                They'll need this code to link their accounts to your organization.
                Keep it safe and share it only with your team members.
              </p>
            </div>
          </div>
        </div>

        {/* Important Note */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Important:</strong> Save this code in a secure location.
            You can always find it later in your Advanced Settings.
          </p>
        </div>

        {/* Continue Button */}
        <button
          onClick={onContinue}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  );
};
