/**
 * Tool Categories - Organized categorization of Composio integrations
 *
 * This module defines logical groupings of tools to help with:
 * - UI organization
 * - Tool discovery
 * - Context-aware tool selection
 * - Rate limiting by category
 */

/**
 * Tool categories mapping
 * Keys are category names, values are arrays of Composio app identifiers
 */
export const TOOL_CATEGORIES = {
  // Communication & Messaging
  COMMUNICATION: [
    'SLACK',
    'DISCORD',
    'TELEGRAM',
    'WHATSAPP',
    'MICROSOFTTEAMS'
  ],

  // Email Services
  EMAIL: [
    'GMAIL',
    'OUTLOOK',
    'SENDGRID',
    'MAILCHIMP'
  ],

  // Calendar & Scheduling
  CALENDAR: [
    'GOOGLECALENDAR',
    'OUTLOOKCALENDAR',
    'CALENDLY',
    'CAL'
  ],

  // Productivity & Project Management
  PRODUCTIVITY: [
    'NOTION',
    'LINEAR',
    'ASANA',
    'TRELLO',
    'JIRA',
    'CLICKUP',
    'MONDAY'
  ],

  // Code & Development
  DEVELOPMENT: [
    'GITHUB',
    'GITLAB',
    'BITBUCKET',
    'VERCEL',
    'HEROKU'
  ],

  // File Storage & Management
  FILES: [
    'GOOGLEDRIVE',
    'DROPBOX',
    'ONEDRIVE',
    'BOX',
    'AMAZONS3'
  ],

  // Document Editing
  DOCUMENTS: [
    'GOOGLEDOCS',
    'GOOGLESHEETS',
    'GOOGLESLIDES',
    'MICROSOFTWORD',
    'MICROSOFTEXCEL',
    'MICROSOFTPOWERPOINT'
  ],

  // CRM & Sales
  CRM: [
    'SALESFORCE',
    'HUBSPOT',
    'PIPEDRIVE',
    'ZOHO'
  ],

  // Payments & Finance
  PAYMENTS: [
    'STRIPE',
    'PAYPAL',
    'QUICKBOOKS'
  ],

  // Social Media
  SOCIAL: [
    'TWITTER',
    'LINKEDIN',
    'FACEBOOK',
    'INSTAGRAM'
  ],

  // Design & Creative
  DESIGN: [
    'FIGMA',
    'CANVA',
    'AIRTABLE'
  ],

  // Analytics & Data
  ANALYTICS: [
    'GOOGLEANALYTICS',
    'MIXPANEL',
    'AMPLITUDE'
  ],

  // Support & Helpdesk
  SUPPORT: [
    'ZENDESK',
    'INTERCOM',
    'FRESHDESK'
  ],

  // Marketing
  MARKETING: [
    'HUBSPOT',
    'MAILCHIMP',
    'TYPEFORM'
  ]
} as const;

/**
 * Get category for a specific app
 * @param appName - Composio app identifier (e.g., 'SLACK', 'GITHUB')
 * @returns Category name or 'OTHER' if not found
 */
export const getCategoryForApp = (appName: string): string => {
  for (const [category, apps] of Object.entries(TOOL_CATEGORIES)) {
    if ((apps as readonly string[]).includes(appName)) {
      return category;
    }
  }
  return 'OTHER';
};

/**
 * Get all apps in a specific category
 * @param category - Category name (e.g., 'COMMUNICATION')
 * @returns Array of app identifiers
 */
export const getAppsInCategory = (category: keyof typeof TOOL_CATEGORIES): readonly string[] => {
  return TOOL_CATEGORIES[category] || [];
};

/**
 * Get human-readable category names
 */
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  COMMUNICATION: 'Communication & Messaging',
  EMAIL: 'Email Services',
  CALENDAR: 'Calendar & Scheduling',
  PRODUCTIVITY: 'Productivity & Projects',
  DEVELOPMENT: 'Code & Development',
  FILES: 'File Storage',
  DOCUMENTS: 'Document Editing',
  CRM: 'CRM & Sales',
  PAYMENTS: 'Payments & Finance',
  SOCIAL: 'Social Media',
  DESIGN: 'Design & Creative',
  ANALYTICS: 'Analytics & Data',
  SUPPORT: 'Customer Support',
  MARKETING: 'Marketing Tools',
  OTHER: 'Other Tools'
};

/**
 * Priority tools that should be shown first in UI
 * These are the most commonly used integrations
 */
export const PRIORITY_TOOLS = [
  'SLACK',
  'GMAIL',
  'GOOGLECALENDAR',
  'NOTION',
  'LINEAR',
  'GITHUB',
  'GOOGLEDRIVE',
  'STRIPE'
] as const;

/**
 * Check if an app is a priority tool
 */
export const isPriorityTool = (appName: string): boolean => {
  return PRIORITY_TOOLS.includes(appName as any);
};

/**
 * Tools that require special permissions or setup
 * These should show additional instructions to users
 */
export const TOOLS_REQUIRING_SETUP = {
  GITHUB: 'Requires repository access permissions',
  SALESFORCE: 'Requires Salesforce admin approval',
  STRIPE: 'Requires Stripe account with API access',
  GOOGLEDRIVE: 'Requires Google Workspace permissions'
} as const;

/**
 * Get setup instructions for a tool
 */
export const getSetupInstructions = (appName: string): string | null => {
  return TOOLS_REQUIRING_SETUP[appName as keyof typeof TOOLS_REQUIRING_SETUP] || null;
};
