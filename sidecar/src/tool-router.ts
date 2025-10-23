/**
 * Tool Router - Intelligent automatic tool selection
 *
 * This module analyzes user prompts to determine:
 * 1. Should tools be used at all? (vs direct LLM response)
 * 2. Which tools are relevant for this request?
 * 3. What's the confidence level?
 *
 * Uses keyword matching + pattern detection for fast routing
 */

import { TOOL_CATEGORIES, getCategoryForApp } from './tool-categories.js';

/**
 * Intent types that map to tool categories
 */
export enum Intent {
  COMMUNICATION = 'communication',
  EMAIL = 'email',
  CALENDAR = 'calendar',
  PROJECT_MANAGEMENT = 'project_management',
  FILES = 'files',
  DOCUMENTS = 'documents',
  CODE = 'code',
  CRM = 'crm',
  ANALYTICS = 'analytics',
  GENERAL = 'general', // No tools needed
}

/**
 * Tool routing result
 */
export interface ToolRoute {
  intent: Intent;
  confidence: number; // 0.0 to 1.0
  shouldUseTools: boolean;
  suggestedTools: string[]; // Tool names (e.g., ['slack', 'discord'])
  reasoning: string; // Why this route was selected
}

/**
 * Keyword patterns for each intent category
 */
const INTENT_PATTERNS: Record<Intent, RegExp[]> = {
  [Intent.COMMUNICATION]: [
    /\b(send|post|message|notify|tell|dm|ping|alert)\b.*\b(team|channel|group|slack|discord|teams)/i,
    /\b(slack|discord|teams|telegram|chat)\b/i,
  ],
  [Intent.EMAIL]: [
    /\b(send|compose|write|draft|reply to?)\b.*\b(email|mail|message)/i,
    /\b(gmail|outlook|email|mail)/i,
    /\b(email|mail)\b.*\b(to|about|regarding)/i,
  ],
  [Intent.CALENDAR]: [
    /\b(schedule|book|add|create|set up)\b.*\b(meeting|event|appointment|call)/i,
    /\b(calendar|schedule|meeting|event|appointment)/i,
    /\b(tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*\b(meeting|call)/i,
  ],
  [Intent.PROJECT_MANAGEMENT]: [
    /\b(create|add|update|close|assign)\b.*\b(issue|ticket|task|bug|feature|story)/i,
    /\b(github|gitlab|jira|linear|asana|trello|notion)\b/i,
    /\b(issue|pr|pull request|ticket|merge request)\b/i,
    /\b(track|manage|organize)\b.*\b(project|task|work|issue)/i,
  ],
  [Intent.FILES]: [
    /\b(upload|download|save|share|move|copy|delete)\b.*\b(file|document|folder|pdf|image)/i,
    /\b(google drive|dropbox|onedrive|drive|storage)/i,
    /\b(find|search|locate)\b.*\b(file|document|folder)/i,
  ],
  [Intent.DOCUMENTS]: [
    /\b(create|edit|update|write)\b.*\b(doc|document|sheet|spreadsheet|slide|presentation)/i,
    /\b(google docs|sheets|slides|microsoft word|excel|powerpoint)/i,
    /\b(add|insert|format)\b.*\b(text|table|chart|paragraph)/i,
  ],
  [Intent.CODE]: [
    /\b(create|open|close|merge|review)\b.*\b(pr|pull request|merge request|commit|branch)/i,
    /\b(push|commit|deploy|clone|fork|star)\b.*\b(code|repo|repository|github|gitlab)/i,
    /\b(ci|cd|build|pipeline|workflow|action)/i,
  ],
  [Intent.CRM]: [
    /\b(add|update|create|find|search)\b.*\b(contact|lead|deal|customer|client|account)/i,
    /\b(salesforce|hubspot|pipedrive|crm)/i,
    /\b(sales|pipeline|opportunity|quote|proposal)/i,
  ],
  [Intent.ANALYTICS]: [
    /\b(track|analyze|measure|monitor|report)\b.*\b(metrics|analytics|data|statistics|performance)/i,
    /\b(google analytics|mixpanel|amplitude|segment)/i,
    /\b(dashboard|chart|graph|visualization)/i,
  ],
  [Intent.GENERAL]: [
    /^(what|who|when|where|why|how|explain|tell me|can you|could you|would you)/i,
    /\b(what is|what's|define|meaning of|explain|describe)/i,
  ],
};

/**
 * Action verbs that indicate tool usage
 */
const ACTION_VERBS = [
  'send', 'create', 'add', 'update', 'delete', 'schedule', 'book', 'upload',
  'download', 'share', 'move', 'copy', 'post', 'publish', 'deploy', 'merge',
  'assign', 'notify', 'alert', 'track', 'search', 'find', 'get', 'fetch'
];

/**
 * Question indicators that suggest no tools needed
 */
const QUESTION_INDICATORS = [
  'what', 'who', 'when', 'where', 'why', 'how', 'which', 'can', 'could',
  'would', 'should', 'is', 'are', 'does', 'do', 'will', 'won\'t'
];

/**
 * Tool Router Class
 * Analyzes messages and routes to appropriate tools
 */
export class ToolRouter {
  /**
   * Analyze a user message and determine tool routing
   * @param message - User's message
   * @param connectedTools - List of tools the user has connected
   * @param conversationHistory - Previous messages for context
   * @returns Tool routing decision
   */
  analyzeMessage(
    message: string,
    connectedTools: string[] = [],
    conversationHistory: any[] = []
  ): ToolRoute {
    const messageLower = message.toLowerCase().trim();

    // Step 1: Detect intent
    const intent = this.detectIntent(messageLower);

    // Step 2: If general intent (question), likely no tools needed
    if (intent === Intent.GENERAL) {
      return {
        intent: Intent.GENERAL,
        confidence: 0.9,
        shouldUseTools: false,
        suggestedTools: [],
        reasoning: 'Question detected - no tools needed for direct answer',
      };
    }

    // Step 3: Check if message contains action verbs
    const hasAction = this.hasActionVerb(messageLower);
    if (!hasAction && !this.hasExplicitToolMention(messageLower)) {
      return {
        intent,
        confidence: 0.3,
        shouldUseTools: false,
        suggestedTools: [],
        reasoning: 'No action verbs or tool mentions - likely informational query',
      };
    }

    // Step 4: Get suggested tools for this intent
    const suggestedTools = this.getToolsForIntent(intent, connectedTools);

    // Step 5: Calculate confidence
    const confidence = this.calculateConfidence(messageLower, intent, suggestedTools, connectedTools);

    // Step 6: Decide if tools should be used
    const shouldUseTools = confidence >= 0.5 && suggestedTools.length > 0;

    return {
      intent,
      confidence,
      shouldUseTools,
      suggestedTools,
      reasoning: this.generateReasoning(intent, confidence, suggestedTools, hasAction),
    };
  }

  /**
   * Detect the primary intent from a message
   */
  private detectIntent(message: string): Intent {
    let bestIntent: Intent = Intent.GENERAL;
    let bestScore = 0;

    // Score each intent based on pattern matches
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent as Intent;
      }
    }

    return bestIntent;
  }

  /**
   * Check if message contains action verbs
   */
  private hasActionVerb(message: string): boolean {
    const words = message.split(/\s+/);
    const firstWords = words.slice(0, 5).join(' ').toLowerCase();

    return ACTION_VERBS.some(verb =>
      firstWords.includes(verb) || message.includes(` ${verb} `)
    );
  }

  /**
   * Check if message explicitly mentions a tool
   */
  private hasExplicitToolMention(message: string): boolean {
    const toolNames = ['slack', 'discord', 'gmail', 'github', 'notion', 'linear',
                      'jira', 'asana', 'calendar', 'drive', 'dropbox'];
    return toolNames.some(tool => message.includes(tool));
  }

  /**
   * Get suggested tools for an intent
   */
  private getToolsForIntent(intent: Intent, connectedTools: string[]): string[] {
    const intentToCategory: Record<Intent, keyof typeof TOOL_CATEGORIES | null> = {
      [Intent.COMMUNICATION]: 'COMMUNICATION',
      [Intent.EMAIL]: 'EMAIL',
      [Intent.CALENDAR]: 'CALENDAR',
      [Intent.PROJECT_MANAGEMENT]: 'PRODUCTIVITY',
      [Intent.FILES]: 'FILES',
      [Intent.DOCUMENTS]: 'DOCUMENTS',
      [Intent.CODE]: 'DEVELOPMENT',
      [Intent.CRM]: 'CRM',
      [Intent.ANALYTICS]: 'ANALYTICS',
      [Intent.GENERAL]: null,
    };

    const category = intentToCategory[intent];
    if (!category) return [];

    const categoryTools = (TOOL_CATEGORIES[category] as readonly string[]) || [];

    // Filter to only connected tools
    if (connectedTools.length > 0) {
      return categoryTools
        .filter((tool: string) => connectedTools.includes(tool.toLowerCase()))
        .map((tool: string) => tool.toLowerCase());
    }

    // Return all tools in category (user may not have any connected yet)
    return categoryTools.map((tool: string) => tool.toLowerCase());
  }

  /**
   * Calculate confidence score (0.0 to 1.0)
   */
  private calculateConfidence(
    message: string,
    intent: Intent,
    suggestedTools: string[],
    connectedTools: string[]
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost if action verb present
    if (this.hasActionVerb(message)) {
      confidence += 0.2;
    }

    // Boost if explicit tool mention
    if (this.hasExplicitToolMention(message)) {
      confidence += 0.2;
    }

    // Boost if user has connected tools in this category
    if (suggestedTools.some(tool => connectedTools.includes(tool))) {
      confidence += 0.15;
    }

    // Reduce if message starts with question words
    const firstWord = message.split(/\s+/)[0].toLowerCase();
    if (QUESTION_INDICATORS.includes(firstWord)) {
      confidence -= 0.3;
    }

    // Reduce if no tools available
    if (suggestedTools.length === 0) {
      confidence = 0.2;
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    intent: Intent,
    confidence: number,
    suggestedTools: string[],
    hasAction: boolean
  ): string {
    if (intent === Intent.GENERAL) {
      return 'Informational query - no tools needed';
    }

    if (confidence < 0.5) {
      return `Low confidence (${(confidence * 100).toFixed(0)}%) - likely doesn't require tools`;
    }

    const intentName = intent.replace(/_/g, ' ');
    const toolList = suggestedTools.slice(0, 3).join(', ');

    if (suggestedTools.length === 0) {
      return `Detected ${intentName} intent but no connected tools available`;
    }

    return `${hasAction ? 'Action' : 'Request'} detected for ${intentName} - suggests tools: ${toolList}`;
  }
}

/**
 * Singleton instance
 */
let toolRouterInstance: ToolRouter | null = null;

/**
 * Get the Tool Router singleton
 */
export const getToolRouter = (): ToolRouter => {
  if (!toolRouterInstance) {
    toolRouterInstance = new ToolRouter();
  }
  return toolRouterInstance;
};
