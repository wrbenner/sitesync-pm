/**
 * Client-side rate limiter to prevent excessive API calls.
 * Implements a sliding window counter per action type.
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  'api:read': { maxRequests: 100, windowMs: 60_000 },
  'api:write': { maxRequests: 30, windowMs: 60_000 },
  'api:upload': { maxRequests: 10, windowMs: 60_000 },
  'ai:chat': { maxRequests: 20, windowMs: 60_000 },
};

const requestLog: Record<string, number[]> = {};

/**
 * Check if an action is allowed under rate limits.
 * Returns true if allowed, false if rate limited.
 */
export function checkRateLimit(action: string): boolean {
  const config = DEFAULT_LIMITS[action] ?? DEFAULT_LIMITS['api:read'];
  const now = Date.now();
  const windowStart = now - config.windowMs;

  if (!requestLog[action]) {
    requestLog[action] = [];
  }

  // Clean expired entries
  requestLog[action] = requestLog[action].filter((t) => t > windowStart);

  if (requestLog[action].length >= config.maxRequests) {
    return false;
  }

  requestLog[action].push(now);
  return true;
}

/**
 * Get remaining requests for an action type.
 */
export function getRemainingRequests(action: string): number {
  const config = DEFAULT_LIMITS[action] ?? DEFAULT_LIMITS['api:read'];
  const now = Date.now();
  const windowStart = now - config.windowMs;

  if (!requestLog[action]) return config.maxRequests;

  const activeRequests = requestLog[action].filter((t) => t > windowStart).length;
  return Math.max(0, config.maxRequests - activeRequests);
}

/**
 * API request logger for audit trail. Logs are stored in memory
 * and can be flushed to the server periodically.
 */
export interface ApiLogEntry {
  timestamp: number;
  action: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  durationMs?: number;
  userId?: string;
}

const apiLog: ApiLogEntry[] = [];
const MAX_LOG_SIZE = 500;

export function logApiRequest(entry: ApiLogEntry) {
  apiLog.push(entry);
  if (apiLog.length > MAX_LOG_SIZE) {
    apiLog.splice(0, apiLog.length - MAX_LOG_SIZE);
  }
}

export function getApiLog(): readonly ApiLogEntry[] {
  return apiLog;
}

export function flushApiLog(): ApiLogEntry[] {
  return apiLog.splice(0, apiLog.length);
}
