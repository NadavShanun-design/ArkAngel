// Subscription & Entitlement Types for ArkAngel

/**
 * Subscription Tiers
 */
export type SubscriptionTier = 'free' | 'premium' | 'max';

/**
 * Feature names that can be gated
 */
export type FeatureName =
  | 'ai_assistance'        // AI chat/completion
  | 'transcription'        // Audio transcription
  | 'custom_personas'      // Create custom AI personas
  | 'rag_training'         // Upload training documents
  | 'cloud_sync'           // Cloud storage/backup
  | 'google_workspace'     // Google Calendar/Gmail integration
  | 'crm_integrations'     // Salesforce, HubSpot, etc.
  | 'team_sharing'         // Share personas with team
  | 'api_access'           // REST API access
  | 'white_label'          // Remove branding
  | 'all_providers';       // Access to all AI providers

/**
 * Usage measurement types
 */
export type UsageType = 'minutes' | 'pages' | 'requests' | 'count';

/**
 * Feature limit configuration
 */
export interface FeatureLimit {
  // Whether the feature is available at all
  available: boolean;

  // Daily limit (null = unlimited)
  dailyLimit: number | null;

  // Monthly limit (null = unlimited)
  monthlyLimit: number | null;

  // Maximum items (for countable features like personas)
  maxItems: number | null;

  // Usage type for tracking
  usageType: UsageType;

  // Tier required to unlock
  requiredTier: SubscriptionTier;

  // User-friendly description
  description: string;

  // Upgrade message
  upgradeMessage: string;
}

/**
 * Complete feature matrix by tier
 */
export const FEATURE_MATRIX: Record<SubscriptionTier, Record<FeatureName, FeatureLimit>> = {
  free: {
    ai_assistance: {
      available: true,
      dailyLimit: 30, // 30 minutes per day
      monthlyLimit: null,
      maxItems: null,
      usageType: 'minutes',
      requiredTier: 'free',
      description: '30 minutes of AI assistance per day',
      upgradeMessage: 'Upgrade to Premium for unlimited AI assistance',
    },
    transcription: {
      available: true,
      dailyLimit: 100, // 100 minutes per day
      monthlyLimit: null,
      maxItems: null,
      usageType: 'minutes',
      requiredTier: 'free',
      description: '100 minutes of transcription per day',
      upgradeMessage: 'Upgrade to Premium for unlimited transcription',
    },
    custom_personas: {
      available: false,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: 0,
      usageType: 'count',
      requiredTier: 'premium',
      description: 'Create custom AI personas',
      upgradeMessage: 'Upgrade to Premium to create custom personas',
    },
    rag_training: {
      available: false,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: 0,
      usageType: 'pages',
      requiredTier: 'premium',
      description: 'Train AI with your documents',
      upgradeMessage: 'Upgrade to Premium for RAG training',
    },
    cloud_sync: {
      available: false,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null,
      usageType: 'count',
      requiredTier: 'premium',
      description: 'Sync across devices',
      upgradeMessage: 'Upgrade to Premium for cloud sync',
    },
    all_providers: {
      available: false, // Can only choose 1 provider
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: 1, // Only 1 provider
      usageType: 'count',
      requiredTier: 'premium',
      description: 'Choose one AI provider',
      upgradeMessage: 'Upgrade to Premium for all AI providers',
    },
    google_workspace: {
      available: false,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null,
      usageType: 'count',
      requiredTier: 'max',
      description: 'Google Calendar and Gmail integration',
      upgradeMessage: 'Upgrade to Max for Google Workspace integration',
    },
    crm_integrations: {
      available: false,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null,
      usageType: 'count',
      requiredTier: 'max',
      description: 'CRM integrations (Salesforce, HubSpot)',
      upgradeMessage: 'Upgrade to Max for CRM integrations',
    },
    team_sharing: {
      available: false,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: 0,
      usageType: 'count',
      requiredTier: 'premium',
      description: 'Share personas with team',
      upgradeMessage: 'Upgrade to Premium for team sharing',
    },
    api_access: {
      available: false,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null,
      usageType: 'requests',
      requiredTier: 'premium',
      description: 'REST API access',
      upgradeMessage: 'Upgrade to Premium for API access',
    },
    white_label: {
      available: false,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null,
      usageType: 'count',
      requiredTier: 'max',
      description: 'Remove ArkAngel branding',
      upgradeMessage: 'Upgrade to Max for white-label mode',
    },
  },

  premium: {
    ai_assistance: {
      available: true,
      dailyLimit: null, // Unlimited
      monthlyLimit: null,
      maxItems: null,
      usageType: 'minutes',
      requiredTier: 'premium',
      description: 'Unlimited AI assistance',
      upgradeMessage: '',
    },
    transcription: {
      available: true,
      dailyLimit: null, // Unlimited
      monthlyLimit: null,
      maxItems: null,
      usageType: 'minutes',
      requiredTier: 'premium',
      description: 'Unlimited transcription',
      upgradeMessage: '',
    },
    custom_personas: {
      available: true,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: 10, // Up to 10 custom personas
      usageType: 'count',
      requiredTier: 'premium',
      description: 'Create up to 10 custom personas',
      upgradeMessage: 'Upgrade to Max for unlimited personas',
    },
    rag_training: {
      available: true,
      dailyLimit: null,
      monthlyLimit: 500, // 500 pages per month
      maxItems: null,
      usageType: 'pages',
      requiredTier: 'premium',
      description: 'Train AI with up to 500 pages per month',
      upgradeMessage: 'Upgrade to Max for unlimited training',
    },
    cloud_sync: {
      available: true,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null,
      usageType: 'count',
      requiredTier: 'premium',
      description: 'Sync across all devices',
      upgradeMessage: '',
    },
    all_providers: {
      available: true, // Can use all providers
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null, // Unlimited providers
      usageType: 'count',
      requiredTier: 'premium',
      description: 'Access all AI providers',
      upgradeMessage: '',
    },
    google_workspace: {
      available: false,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null,
      usageType: 'count',
      requiredTier: 'max',
      description: 'Google Calendar and Gmail integration',
      upgradeMessage: 'Upgrade to Max for Google Workspace integration',
    },
    crm_integrations: {
      available: false,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null,
      usageType: 'count',
      requiredTier: 'max',
      description: 'CRM integrations (Salesforce, HubSpot)',
      upgradeMessage: 'Upgrade to Max for CRM integrations',
    },
    team_sharing: {
      available: true,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: 5, // Up to 5 team members
      usageType: 'count',
      requiredTier: 'premium',
      description: 'Share with up to 5 team members',
      upgradeMessage: 'Upgrade to Max for unlimited team members',
    },
    api_access: {
      available: true,
      dailyLimit: 100, // 100 requests per day
      monthlyLimit: null,
      maxItems: null,
      usageType: 'requests',
      requiredTier: 'premium',
      description: '100 API requests per day',
      upgradeMessage: 'Upgrade to Max for unlimited API access',
    },
    white_label: {
      available: false,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null,
      usageType: 'count',
      requiredTier: 'max',
      description: 'Remove ArkAngel branding',
      upgradeMessage: 'Upgrade to Max for white-label mode',
    },
  },

  max: {
    ai_assistance: {
      available: true,
      dailyLimit: null, // Unlimited
      monthlyLimit: null,
      maxItems: null,
      usageType: 'minutes',
      requiredTier: 'max',
      description: 'Unlimited AI assistance',
      upgradeMessage: '',
    },
    transcription: {
      available: true,
      dailyLimit: null, // Unlimited
      monthlyLimit: null,
      maxItems: null,
      usageType: 'minutes',
      requiredTier: 'max',
      description: 'Unlimited transcription',
      upgradeMessage: '',
    },
    custom_personas: {
      available: true,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null, // Unlimited
      usageType: 'count',
      requiredTier: 'max',
      description: 'Unlimited custom personas',
      upgradeMessage: '',
    },
    rag_training: {
      available: true,
      dailyLimit: null,
      monthlyLimit: null, // Unlimited
      maxItems: null,
      usageType: 'pages',
      requiredTier: 'max',
      description: 'Unlimited document training',
      upgradeMessage: '',
    },
    cloud_sync: {
      available: true,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null,
      usageType: 'count',
      requiredTier: 'max',
      description: 'Sync across all devices',
      upgradeMessage: '',
    },
    all_providers: {
      available: true, // Can use all providers
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null, // Unlimited providers
      usageType: 'count',
      requiredTier: 'max',
      description: 'Access all AI providers',
      upgradeMessage: '',
    },
    google_workspace: {
      available: true,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null,
      usageType: 'count',
      requiredTier: 'max',
      description: 'Full Google Workspace integration',
      upgradeMessage: '',
    },
    crm_integrations: {
      available: true,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null,
      usageType: 'count',
      requiredTier: 'max',
      description: 'Full CRM integrations',
      upgradeMessage: '',
    },
    team_sharing: {
      available: true,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null, // Unlimited team members
      usageType: 'count',
      requiredTier: 'max',
      description: 'Unlimited team members',
      upgradeMessage: '',
    },
    api_access: {
      available: true,
      dailyLimit: null, // Unlimited
      monthlyLimit: null,
      maxItems: null,
      usageType: 'requests',
      requiredTier: 'max',
      description: 'Unlimited API access',
      upgradeMessage: '',
    },
    white_label: {
      available: true,
      dailyLimit: null,
      monthlyLimit: null,
      maxItems: null,
      usageType: 'count',
      requiredTier: 'max',
      description: 'Full white-label mode',
      upgradeMessage: '',
    },
  },
};

/**
 * Usage information for a feature
 */
export interface UsageInfo {
  feature: FeatureName;
  used: number;
  limit: number | null; // null = unlimited
  percentage: number; // 0-100, or 0 if unlimited
  remaining: number | null; // null = unlimited
  period: 'daily' | 'monthly';
}

/**
 * Entitlement check result
 */
export interface EntitlementCheck {
  allowed: boolean;
  reason?: string; // Why it's not allowed
  upgradeMessage?: string;
  requiredTier?: SubscriptionTier;
  currentUsage?: UsageInfo;
}

/**
 * Pricing information
 */
export const PRICING: Record<SubscriptionTier, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  premium: { monthly: 14.99, annual: 144 }, // 20% off annually
  max: { monthly: 39.99, annual: 384 }, // 20% off annually
};

/**
 * Tier comparison for UI display
 */
export const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  free: [
    '30 minutes AI assistance per day',
    '100 minutes transcription per day',
    '3 saved conversations (local)',
    '3 pre-made personas',
    '1 AI provider choice',
    'Basic PII scrubbing',
  ],
  premium: [
    'Unlimited AI assistance',
    'Unlimited transcription',
    'Unlimited saved conversations',
    'Cloud sync across devices',
    '10 custom personas',
    'All AI providers (OpenAI, Claude, Gemini, Grok)',
    'RAG training (500 pages/month)',
    'Advanced PII scrubbing',
    'Team sharing (5 members)',
    'API access (100 requests/day)',
    'Priority email support',
  ],
  max: [
    'Everything in Premium, plus:',
    'Unlimited custom personas',
    'Unlimited RAG training',
    'Google Workspace integration',
    'CRM integrations (Salesforce, HubSpot)',
    'Unlimited team members',
    'Unlimited API access',
    'White-label mode',
    'Dedicated support',
    'SSO/SAML',
  ],
};
