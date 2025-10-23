import OpenAI from 'openai';
import type { UITarsConfig } from './types.js';

export interface ValidationResult {
  success: boolean;
  error?: string;
  details?: string;
}

/**
 * Validates the API key by making a test request to the provider
 */
export async function validateApiKey(config: UITarsConfig): Promise<ValidationResult> {
  console.log(`[Validator] Testing API key for provider: ${config.provider}`);

  try {
    // Create OpenAI client (works for all OpenAI-compatible providers)
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    // Make a minimal test request
    console.log('[Validator] Sending test request to API...');

    const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5,
    });

    if (response.choices && response.choices.length > 0) {
      console.log('[Validator] ✅ API key is valid!');
      return {
        success: true,
        details: `Successfully connected to ${config.provider} with model ${config.model}`,
      };
    }

    console.error('[Validator] ❌ Unexpected response format');
    return {
      success: false,
      error: 'Invalid response format from API',
      details: 'The API responded but the format was unexpected',
    };
  } catch (error: any) {
    console.error('[Validator] ❌ API validation failed:', error);

    // Parse common error types
    if (error.status === 401) {
      return {
        success: false,
        error: 'Invalid API Key',
        details: 'The API key you provided is invalid or expired. Please check your key.',
      };
    }

    if (error.status === 403) {
      return {
        success: false,
        error: 'API Key Forbidden',
        details: 'Your API key does not have permission to access this model or endpoint.',
      };
    }

    if (error.status === 404) {
      return {
        success: false,
        error: 'Model Not Found',
        details: `The model "${config.model}" was not found. Please check the model name.`,
      };
    }

    if (error.status === 429) {
      return {
        success: false,
        error: 'Rate Limit Exceeded',
        details: 'You have exceeded the rate limit for this API key. Please try again later.',
      };
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'Connection Failed',
        details: `Could not connect to ${config.baseURL}. Please check your internet connection and base URL.`,
      };
    }

    return {
      success: false,
      error: 'API Validation Failed',
      details: error.message || 'Unknown error occurred while validating API key',
    };
  }
}

/**
 * Checks if the system has required permissions (macOS Screen Recording + Accessibility)
 */
export async function checkSystemPermissions(): Promise<ValidationResult> {
  console.log('[Validator] Checking system permissions...');

  // This will be checked by Rust via Tauri command
  // For now, return success as the check happens in Rust
  return {
    success: true,
    details: 'Permission check will be performed by the system',
  };
}
