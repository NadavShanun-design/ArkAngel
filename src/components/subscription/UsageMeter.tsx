import React from 'react';
import { FeatureName } from '@/types/subscription';
import { useFeatureUsage } from '@/hooks/useFeatureGate';
import { AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';

interface UsageMeterProps {
  feature: FeatureName;
  period?: 'daily' | 'monthly';
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}

export const UsageMeter: React.FC<UsageMeterProps> = ({
  feature,
  period = 'daily',
  showLabel = true,
  compact = false,
  className = '',
}) => {
  const { used, limit, percentage, remaining, isLoading } = useFeatureUsage(feature, period);

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  // If unlimited, show checkmark
  if (limit === null) {
    return showLabel ? (
      <div className={`flex items-center gap-2 text-sm text-green-600 dark:text-green-400 ${className}`}>
        <CheckCircle className="w-4 h-4" />
        <span>Unlimited</span>
      </div>
    ) : null;
  }

  // Calculate color based on percentage
  const getColor = () => {
    if (percentage >= 90) return 'red';
    if (percentage >= 70) return 'yellow';
    return 'green';
  };

  const color = getColor();
  const colorClasses = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
  };

  const textColorClasses = {
    red: 'text-red-600 dark:text-red-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    green: 'text-green-600 dark:text-green-400',
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${colorClasses[color]} transition-all duration-300`}
            style={{ width: `${Math.min(100, percentage)}%` }}
          ></div>
        </div>
        <span className={`text-xs ${textColorClasses[color]} font-medium whitespace-nowrap`}>
          {used}/{limit}
        </span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-700 dark:text-gray-300 font-medium">
            {period === 'daily' ? 'Today' : 'This Month'}
          </span>
          <span className={`${textColorClasses[color]} font-medium`}>
            {used} / {limit}
          </span>
        </div>
      )}

      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-300`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        ></div>
      </div>

      {percentage >= 80 && remaining !== null && (
        <div className={`flex items-center gap-1 text-xs ${textColorClasses[color]}`}>
          <AlertCircle className="w-3 h-3" />
          <span>
            {remaining > 0
              ? `${remaining} remaining`
              : 'Limit reached'}
          </span>
        </div>
      )}

      {percentage < 80 && remaining !== null && remaining > 0 && (
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <TrendingUp className="w-3 h-3" />
          <span>{remaining} remaining</span>
        </div>
      )}
    </div>
  );
};

/**
 * Simple badge showing usage status
 */
interface UsageBadgeProps {
  feature: FeatureName;
  period?: 'daily' | 'monthly';
}

export const UsageBadge: React.FC<UsageBadgeProps> = ({ feature, period = 'daily' }) => {
  const { used, limit, percentage, isLoading } = useFeatureUsage(feature, period);

  if (isLoading) return null;

  if (limit === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 rounded">
        <CheckCircle className="w-3 h-3" />
        Unlimited
      </span>
    );
  }

  const getVariant = () => {
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  const variant = getVariant();
  const variantClasses = {
    danger: 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
    warning: 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
    success: 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${variantClasses[variant]}`}>
      {used}/{limit}
    </span>
  );
};
