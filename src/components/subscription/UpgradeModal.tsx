import React from 'react';
import { FeatureName, SubscriptionTier, PRICING, TIER_FEATURES } from '@/types/subscription';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { X, Zap, Crown, Star } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: FeatureName;
  reason?: string;
  requiredTier?: SubscriptionTier;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  feature,
  reason,
  requiredTier,
}) => {
  const { tier, getFeatureLimit } = useEntitlement();

  if (!isOpen) return null;

  const featureInfo = feature ? getFeatureLimit(feature) : null;

  const getTierIcon = (tierName: SubscriptionTier) => {
    switch (tierName) {
      case 'free':
        return <Star className="w-5 h-5" />;
      case 'premium':
        return <Zap className="w-5 h-5" />;
      case 'max':
        return <Crown className="w-5 h-5" />;
    }
  };

  const getTierColor = (tierName: SubscriptionTier) => {
    switch (tierName) {
      case 'free':
        return 'text-gray-500';
      case 'premium':
        return 'text-blue-500';
      case 'max':
        return 'text-purple-500';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Upgrade to Unlock
            </h2>
            {reason && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{reason}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Feature Description */}
        {featureInfo && (
          <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-800">
            <p className="text-gray-800 dark:text-gray-200">
              {featureInfo.upgradeMessage || featureInfo.description}
            </p>
          </div>
        )}

        {/* Pricing Tiers */}
        <div className="p-6 grid md:grid-cols-3 gap-4">
          {/* Free Tier */}
          <div
            className={`p-6 rounded-lg border-2 ${
              tier === 'free'
                ? 'border-gray-400 bg-gray-50 dark:bg-gray-800'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              {getTierIcon('free')}
              <h3 className={`text-xl font-bold ${getTierColor('free')}`}>Free</h3>
            </div>
            <div className="mb-4">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">$0</span>
              <span className="text-gray-600 dark:text-gray-400">/month</span>
            </div>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {TIER_FEATURES.free.map((feature, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {tier === 'free' && (
              <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                Current Plan
              </div>
            )}
          </div>

          {/* Premium Tier */}
          <div
            className={`p-6 rounded-lg border-2 ${
              tier === 'premium'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : requiredTier === 'premium'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              {getTierIcon('premium')}
              <h3 className={`text-xl font-bold ${getTierColor('premium')}`}>Premium</h3>
              {requiredTier === 'premium' && (
                <span className="ml-auto text-xs bg-blue-500 text-white px-2 py-1 rounded">
                  Recommended
                </span>
              )}
            </div>
            <div className="mb-4">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                ${PRICING.premium.monthly}
              </span>
              <span className="text-gray-600 dark:text-gray-400">/month</span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                or ${PRICING.premium.annual}/year (save 20%)
              </p>
            </div>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {TIER_FEATURES.premium.map((feature, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {tier === 'premium' ? (
              <div className="mt-4 text-center text-sm text-blue-600 dark:text-blue-400">
                Current Plan
              </div>
            ) : (
              <button
                onClick={() => {
                  // TODO: Integrate with Stripe checkout
                  console.log('Upgrade to Premium');
                }}
                className="mt-4 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                Upgrade to Premium
              </button>
            )}
          </div>

          {/* Max Tier */}
          <div
            className={`p-6 rounded-lg border-2 ${
              tier === 'max'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : requiredTier === 'max'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-500'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              {getTierIcon('max')}
              <h3 className={`text-xl font-bold ${getTierColor('max')}`}>Max</h3>
              {requiredTier === 'max' && (
                <span className="ml-auto text-xs bg-purple-500 text-white px-2 py-1 rounded">
                  Required
                </span>
              )}
            </div>
            <div className="mb-4">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                ${PRICING.max.monthly}
              </span>
              <span className="text-gray-600 dark:text-gray-400">/month</span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                or ${PRICING.max.annual}/year (save 20%)
              </p>
            </div>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {TIER_FEATURES.max.map((feature, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {tier === 'max' ? (
              <div className="mt-4 text-center text-sm text-purple-600 dark:text-purple-400">
                Current Plan
              </div>
            ) : (
              <button
                onClick={() => {
                  // TODO: Integrate with Stripe checkout
                  console.log('Upgrade to Max');
                }}
                className="mt-4 w-full py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
              >
                Upgrade to Max
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            All plans include a 14-day free trial. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
};
