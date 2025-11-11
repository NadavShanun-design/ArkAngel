import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  SubscriptionTier,
  FeatureName,
  FEATURE_MATRIX,
  FeatureLimit,
  UsageInfo,
  EntitlementCheck,
} from '@/types/subscription';
import { getTodayUsage, getMonthUsage, logUsage, getAllTodayUsage } from '@/lib/supabase';

interface EntitlementContextType {
  // Current state
  tier: SubscriptionTier;
  isLoading: boolean;
  error: string | null;

  // Feature checking
  canUseFeature: (feature: FeatureName) => Promise<EntitlementCheck>;

  // Usage info
  getUsageInfo: (feature: FeatureName, period?: 'daily' | 'monthly') => Promise<UsageInfo>;
  getAllUsageToday: () => Promise<Record<string, number>>;

  // Actions
  logFeatureUsage: (feature: FeatureName, amount: number, metadata?: Record<string, any>) => Promise<void>;
  refreshUsage: () => Promise<void>;

  // UI helpers
  getFeatureLimit: (feature: FeatureName) => FeatureLimit;
  isFeatureAvailable: (feature: FeatureName) => boolean;
  getRequiredTier: (feature: FeatureName) => SubscriptionTier;
}

const EntitlementContext = createContext<EntitlementContextType | undefined>(undefined);

interface EntitlementProviderProps {
  children: ReactNode;
}

export const EntitlementProvider: React.FC<EntitlementProviderProps> = ({ children }) => {
  const { user, isAuthenticated: _isAuthenticated } = useAuth(); // underscore prefix to indicate intentionally unused
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageCache, setUsageCache] = useState<Record<string, number>>({});

  // Determine user's tier (guest/unauthenticated = free)
  const tier: SubscriptionTier = (user?.subscription_tier as SubscriptionTier) || 'free';

  // Get feature limit configuration for current tier
  const getFeatureLimit = useCallback((feature: FeatureName): FeatureLimit => {
    return FEATURE_MATRIX[tier][feature];
  }, [tier]);

  // Check if feature is available at all (ignoring usage limits)
  const isFeatureAvailable = useCallback((feature: FeatureName): boolean => {
    return getFeatureLimit(feature).available;
  }, [getFeatureLimit]);

  // Get required tier for a feature
  const getRequiredTier = useCallback((feature: FeatureName): SubscriptionTier => {
    return getFeatureLimit(feature).requiredTier;
  }, [getFeatureLimit]);

  // Load all usage data for today
  const refreshUsage = useCallback(async () => {
    if (!user) {
      setUsageCache({});
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const usage = await getAllTodayUsage(user.id);
      setUsageCache(usage);
    } catch (err: any) {
      console.error('Failed to refresh usage:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initialize usage data on mount and when user changes
  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  // Auto-refresh usage every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshUsage();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [refreshUsage]);

  // Get usage info for a specific feature
  const getUsageInfo = useCallback(async (
    feature: FeatureName,
    period: 'daily' | 'monthly' = 'daily'
  ): Promise<UsageInfo> => {
    const limit = getFeatureLimit(feature);

    // If user is not authenticated, return zero usage
    if (!user) {
      return {
        feature,
        used: 0,
        limit: period === 'daily' ? limit.dailyLimit : limit.monthlyLimit,
        percentage: 0,
        remaining: period === 'daily' ? limit.dailyLimit : limit.monthlyLimit,
        period,
      };
    }

    try {
      // Fetch usage from Supabase
      const used = period === 'daily'
        ? await getTodayUsage(user.id, feature)
        : await getMonthUsage(user.id, feature);

      const limitValue = period === 'daily' ? limit.dailyLimit : limit.monthlyLimit;

      // Calculate stats
      const percentage = limitValue === null ? 0 : (used / limitValue) * 100;
      const remaining = limitValue === null ? null : Math.max(0, limitValue - used);

      return {
        feature,
        used,
        limit: limitValue,
        percentage: Math.min(100, percentage),
        remaining,
        period,
      };
    } catch (err: any) {
      console.error(`Failed to get usage info for ${feature}:`, err);
      throw err;
    }
  }, [user, getFeatureLimit]);

  // Get all usage for today (cached)
  const getAllUsageToday = useCallback(async (): Promise<Record<string, number>> => {
    return usageCache;
  }, [usageCache]);

  // Check if user can use a feature
  const canUseFeature = useCallback(async (feature: FeatureName): Promise<EntitlementCheck> => {
    const limit = getFeatureLimit(feature);

    // Check 1: Is feature available at this tier at all?
    if (!limit.available) {
      return {
        allowed: false,
        reason: `This feature requires ${limit.requiredTier} tier`,
        upgradeMessage: limit.upgradeMessage,
        requiredTier: limit.requiredTier,
      };
    }

    // Check 2: If no limits, it's unlimited - allow
    if (limit.dailyLimit === null && limit.monthlyLimit === null && limit.maxItems === null) {
      return {
        allowed: true,
      };
    }

    // Check 3: Check usage limits (daily, then monthly)
    if (user) {
      try {
        // Check daily limit
        if (limit.dailyLimit !== null) {
          const usageInfo = await getUsageInfo(feature, 'daily');
          if (usageInfo.used >= limit.dailyLimit) {
            return {
              allowed: false,
              reason: `Daily limit reached (${usageInfo.used}/${limit.dailyLimit} ${limit.usageType})`,
              upgradeMessage: limit.upgradeMessage || 'Upgrade for higher limits',
              requiredTier: limit.requiredTier,
              currentUsage: usageInfo,
            };
          }
        }

        // Check monthly limit
        if (limit.monthlyLimit !== null) {
          const usageInfo = await getUsageInfo(feature, 'monthly');
          if (usageInfo.used >= limit.monthlyLimit) {
            return {
              allowed: false,
              reason: `Monthly limit reached (${usageInfo.used}/${limit.monthlyLimit} ${limit.usageType})`,
              upgradeMessage: limit.upgradeMessage || 'Upgrade for higher limits',
              requiredTier: limit.requiredTier,
              currentUsage: usageInfo,
            };
          }
        }

        // Check max items (for countable features like personas)
        if (limit.maxItems !== null) {
          // This would need to be checked by the feature itself
          // For now, we just indicate the limit exists
          // The actual check happens when counting personas, etc.
        }
      } catch (err: any) {
        console.error(`Failed to check usage for ${feature}:`, err);
        // On error, allow (fail open) but log error
        return {
          allowed: true,
          reason: 'Failed to check usage limits',
        };
      }
    }

    // All checks passed
    return {
      allowed: true,
    };
  }, [user, getFeatureLimit, getUsageInfo]);

  // Log usage for a feature
  const logFeatureUsage = useCallback(async (
    feature: FeatureName,
    amount: number,
    metadata?: Record<string, any>
  ) => {
    if (!user) {
      console.warn('Cannot log usage for unauthenticated user');
      return;
    }

    const limit = getFeatureLimit(feature);

    try {
      await logUsage(user.id, feature, amount, limit.usageType, metadata);
      // Refresh usage cache after logging
      await refreshUsage();
    } catch (err: any) {
      console.error(`Failed to log usage for ${feature}:`, err);
      setError(err.message);
    }
  }, [user, getFeatureLimit, refreshUsage]);

  const value: EntitlementContextType = {
    tier,
    isLoading,
    error,
    canUseFeature,
    getUsageInfo,
    getAllUsageToday,
    logFeatureUsage,
    refreshUsage,
    getFeatureLimit,
    isFeatureAvailable,
    getRequiredTier,
  };

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
};

export const useEntitlement = () => {
  const context = useContext(EntitlementContext);
  if (context === undefined) {
    throw new Error('useEntitlement must be used within an EntitlementProvider');
  }
  return context;
};
