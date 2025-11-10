import { useState, useEffect, useCallback } from 'react';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { FeatureName, EntitlementCheck, UsageInfo } from '@/types/subscription';

/**
 * Hook to check if a feature can be used
 *
 * @param feature - The feature to check
 * @returns Object with allowed status, reason, and check function
 *
 * @example
 * ```tsx
 * const { allowed, reason, check, isLoading } = useFeatureGate('ai_assistance');
 *
 * if (!allowed) {
 *   return <UpgradePrompt reason={reason} />;
 * }
 * ```
 */
export const useFeatureGate = (feature: FeatureName) => {
  const { canUseFeature, logFeatureUsage } = useEntitlement();
  const [check, setCheck] = useState<EntitlementCheck | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const performCheck = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await canUseFeature(feature);
      setCheck(result);
      return result;
    } catch (error) {
      console.error(`Failed to check feature ${feature}:`, error);
      // Fail open - allow on error
      const fallback: EntitlementCheck = { allowed: true };
      setCheck(fallback);
      return fallback;
    } finally {
      setIsLoading(false);
    }
  }, [canUseFeature, feature]);

  // Check on mount
  useEffect(() => {
    performCheck();
  }, [performCheck]);

  const logUsage = useCallback(
    async (amount: number, metadata?: Record<string, any>) => {
      await logFeatureUsage(feature, amount, metadata);
    },
    [logFeatureUsage, feature]
  );

  return {
    allowed: check?.allowed ?? false,
    reason: check?.reason,
    upgradeMessage: check?.upgradeMessage,
    requiredTier: check?.requiredTier,
    currentUsage: check?.currentUsage,
    isLoading,
    recheck: performCheck,
    logUsage,
  };
};

/**
 * Hook to get usage info for a feature
 *
 * @param feature - The feature to get usage for
 * @param period - Daily or monthly usage (default: daily)
 * @returns Usage information
 *
 * @example
 * ```tsx
 * const { used, limit, percentage, remaining } = useFeatureUsage('transcription');
 *
 * return (
 *   <div>
 *     Used: {used}/{limit} minutes ({percentage.toFixed(0)}%)
 *   </div>
 * );
 * ```
 */
export const useFeatureUsage = (
  feature: FeatureName,
  period: 'daily' | 'monthly' = 'daily'
) => {
  const { getUsageInfo, refreshUsage } = useEntitlement();
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsage = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const info = await getUsageInfo(feature, period);
      setUsage(info);
    } catch (err: any) {
      console.error(`Failed to load usage for ${feature}:`, err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [getUsageInfo, feature, period]);

  // Load usage on mount
  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  return {
    used: usage?.used ?? 0,
    limit: usage?.limit ?? null,
    percentage: usage?.percentage ?? 0,
    remaining: usage?.remaining ?? null,
    period: usage?.period ?? period,
    isLoading,
    error,
    refresh: async () => {
      await refreshUsage();
      await loadUsage();
    },
  };
};

/**
 * Hook to check if a feature is available at current tier (ignoring usage)
 *
 * @param feature - The feature to check
 * @returns Whether feature is available
 *
 * @example
 * ```tsx
 * const isAvailable = useFeatureAvailable('custom_personas');
 *
 * if (!isAvailable) {
 *   return <UpgradePrompt feature="custom_personas" />;
 * }
 * ```
 */
export const useFeatureAvailable = (feature: FeatureName) => {
  const { isFeatureAvailable } = useEntitlement();
  return isFeatureAvailable(feature);
};

/**
 * Hook to get required tier for a feature
 *
 * @param feature - The feature to check
 * @returns Required tier
 *
 * @example
 * ```tsx
 * const requiredTier = useRequiredTier('google_workspace');
 * // Returns 'max'
 * ```
 */
export const useRequiredTier = (feature: FeatureName) => {
  const { getRequiredTier } = useEntitlement();
  return getRequiredTier(feature);
};

/**
 * Hook to get feature limit configuration
 *
 * @param feature - The feature to get limits for
 * @returns Feature limit configuration
 *
 * @example
 * ```tsx
 * const limit = useFeatureLimit('ai_assistance');
 * // { available: true, dailyLimit: 30, usageType: 'minutes', ... }
 * ```
 */
export const useFeatureLimit = (feature: FeatureName) => {
  const { getFeatureLimit } = useEntitlement();
  return getFeatureLimit(feature);
};
