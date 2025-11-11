import React from 'react';
import { FeatureName, SubscriptionTier } from '@/types/subscription';
import { useRequiredTier, useFeatureAvailable } from '@/hooks/useFeatureGate';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { Zap, Crown, Lock, Check } from 'lucide-react';

interface FeatureBadgeProps {
  feature: FeatureName;
  showIcon?: boolean;
  compact?: boolean;
  className?: string;
}

export const FeatureBadge: React.FC<FeatureBadgeProps> = ({
  feature,
  showIcon = true,
  compact = false,
  className = '',
}) => {
  const requiredTier = useRequiredTier(feature);
  const isAvailable = useFeatureAvailable(feature);
  const { tier: _tier } = useEntitlement(); // underscore prefix to indicate intentionally unused

  const getTierIcon = (tierName: SubscriptionTier) => {
    switch (tierName) {
      case 'free':
        return <Check className="w-3 h-3" />;
      case 'premium':
        return <Zap className="w-3 h-3" />;
      case 'max':
        return <Crown className="w-3 h-3" />;
    }
  };

  const getTierLabel = (tierName: SubscriptionTier) => {
    return tierName.charAt(0).toUpperCase() + tierName.slice(1);
  };

  const getTierClasses = (tierName: SubscriptionTier) => {
    switch (tierName) {
      case 'free':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'premium':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'max':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    }
  };

  // If user has access, show "Available" badge
  if (isAvailable) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${
          compact ? 'px-1.5 py-0.5' : ''
        } bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ${className}`}
      >
        {showIcon && <Check className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />}
        {!compact && 'Available'}
      </span>
    );
  }

  // Otherwise, show required tier
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${
        compact ? 'px-1.5 py-0.5' : ''
      } ${getTierClasses(requiredTier)} ${className}`}
    >
      {showIcon && getTierIcon(requiredTier)}
      {compact ? getTierLabel(requiredTier).charAt(0) : getTierLabel(requiredTier)}
    </span>
  );
};

/**
 * Feature lock indicator - shows lock icon if feature is not available
 */
interface FeatureLockProps {
  feature: FeatureName;
  className?: string;
}

export const FeatureLock: React.FC<FeatureLockProps> = ({ feature, className = '' }) => {
  const isAvailable = useFeatureAvailable(feature);
  const requiredTier = useRequiredTier(feature);

  if (isAvailable) return null;

  return (
    <div className={`inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 ${className}`}>
      <Lock className="w-3 h-3" />
      <span className="text-xs">{requiredTier}</span>
    </div>
  );
};

/**
 * Feature card with lock overlay
 */
interface FeatureCardProps {
  feature: FeatureName;
  title: string;
  description: string;
  icon?: React.ReactNode;
  onUpgrade?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  feature,
  title,
  description,
  icon,
  onUpgrade,
  children,
  className = '',
}) => {
  const isAvailable = useFeatureAvailable(feature);
  const requiredTier = useRequiredTier(feature);

  return (
    <div className={`relative ${className}`}>
      <div
        className={`p-4 rounded-lg border ${
          isAvailable
            ? 'border-gray-200 dark:border-gray-700'
            : 'border-gray-300 dark:border-gray-600 opacity-60'
        }`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon && <div className="text-gray-700 dark:text-gray-300">{icon}</div>}
            <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          </div>
          <FeatureBadge feature={feature} />
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{description}</p>

        {children}

        {!isAvailable && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onUpgrade}
              className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
            >
              Upgrade to {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
            </button>
          </div>
        )}
      </div>

      {!isAvailable && (
        <div className="absolute inset-0 bg-gray-900/5 dark:bg-gray-100/5 rounded-lg pointer-events-none flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg">
            <Lock className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </div>
        </div>
      )}
    </div>
  );
};
