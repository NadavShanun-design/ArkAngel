import type { UITarsConfig } from './types.js';

export const PROVIDER_CONFIGS: Record<string, Partial<UITarsConfig>> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    model: 'claude-3-7-sonnet-latest',
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash-exp',
  },
  grok: {
    baseURL: 'https://api.x.ai/v1',
    model: 'grok-2-vision-1212',
  },
  volcengine: {
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-1-5-thinking-vision-pro-250428',
  },
};

export function getProviderConfig(config: UITarsConfig) {
  const baseConfig = PROVIDER_CONFIGS[config.provider] || {};

  return {
    baseURL: config.baseURL || baseConfig.baseURL,
    apiKey: config.apiKey,
    model: config.model || baseConfig.model,
  };
}
