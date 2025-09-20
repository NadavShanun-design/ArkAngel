interface RateLimit {
  requests: number;
  windowStart: number;
  maxRequests: number;
  windowMs: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  retryAfterMs: number;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private limits: Map<string, RateLimit> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  constructor() {
    // Configure rate limits for different providers
    this.configs.set('openai', {
      maxRequests: 3, // Conservative limit for OpenAI
      windowMs: 60000, // 1 minute window
      retryAfterMs: 20000 // 20 seconds retry after
    });

    this.configs.set('anthropic', {
      maxRequests: 2, // Conservative limit for Anthropic
      windowMs: 60000, // 1 minute window
      retryAfterMs: 30000 // 30 seconds retry after
    });

    this.configs.set('mcp', {
      maxRequests: 1, // Very conservative for MCP calls
      windowMs: 10000, // 10 second window
      retryAfterMs: 5000 // 5 seconds retry after
    });
  }

  /**
   * Check if a request is allowed for the given key
   */
  async checkLimit(key: string, operation: string = 'default'): Promise<boolean> {
    const fullKey = `${key}_${operation}`;
    const config = this.configs.get(key) || this.configs.get('mcp')!;
    const now = Date.now();

    let limit = this.limits.get(fullKey);
    
    if (!limit) {
      limit = {
        requests: 0,
        windowStart: now,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs
      };
      this.limits.set(fullKey, limit);
    }

    // Reset window if it's expired
    if (now - limit.windowStart > limit.windowMs) {
      limit.requests = 0;
      limit.windowStart = now;
    }

    // Check if we're under the limit
    if (limit.requests < limit.maxRequests) {
      limit.requests++;
      console.log(`[RateLimit] ${fullKey}: ${limit.requests}/${limit.maxRequests} requests in window`);
      return true;
    }

    console.log(`[RateLimit] ${fullKey}: Rate limit exceeded (${limit.requests}/${limit.maxRequests})`);
    return false;
  }

  /**
   * Record a request (called after successful request)
   */
  async recordRequest(key: string, operation: string = 'default'): Promise<void> {
    const fullKey = `${key}_${operation}`;
    const limit = this.limits.get(fullKey);
    
    if (limit) {
      // Request already counted in checkLimit
      console.log(`[RateLimit] ${fullKey}: Request recorded`);
    }
  }

  /**
   * Get retry after time in milliseconds
   */
  async getRetryAfter(key: string): Promise<number> {
    const config = this.configs.get(key) || this.configs.get('mcp')!;
    return config.retryAfterMs;
  }

  /**
   * Get current request count for a key
   */
  getRequestCount(key: string, operation: string = 'default'): number {
    const fullKey = `${key}_${operation}`;
    const limit = this.limits.get(fullKey);
    return limit ? limit.requests : 0;
  }

  /**
   * Reset rate limit for a key
   */
  resetLimit(key: string, operation: string = 'default'): void {
    const fullKey = `${key}_${operation}`;
    this.limits.delete(fullKey);
    console.log(`[RateLimit] ${fullKey}: Rate limit reset`);
  }

  /**
   * Wait for rate limit to reset
   */
  async waitForReset(key: string, operation: string = 'default'): Promise<void> {
    const retryAfter = await this.getRetryAfter(key);
    console.log(`[RateLimit] Waiting ${retryAfter}ms for rate limit reset...`);
    await new Promise(resolve => setTimeout(resolve, retryAfter));
  }

  /**
   * Check and wait if rate limited
   */
  async checkAndWait(key: string, operation: string = 'default'): Promise<void> {
    const allowed = await this.checkLimit(key, operation);
    if (!allowed) {
      await this.waitForReset(key, operation);
    }
  }
}



