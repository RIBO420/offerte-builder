/**
 * Rate Limiter for Next.js API Routes
 *
 * In-memory rate limiting utility with sliding window algorithm.
 * Supports per-user and per-IP rate limiting.
 */

export interface RateLimitConfig {
  maxRequests: number; // Maximum requests allowed
  windowMs: number; // Time window in milliseconds
}

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Timestamp when window resets
  retryAfterMs?: number; // Milliseconds until retry is allowed
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * In-memory store for rate limit data.
 * In production with multiple instances, consider using Redis.
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of rateLimitStore.entries()) {
        // Remove entries that are more than 2 windows old
        if (now - entry.windowStart > 120000) {
          rateLimitStore.delete(key);
        }
      }
    },
    5 * 60 * 1000
  );
}

/**
 * Check rate limit for a given identifier.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitInfo {
  const { maxRequests, windowMs } = config;
  const now = Date.now();

  const entry = rateLimitStore.get(identifier);

  // New window or expired window
  if (!entry || now - entry.windowStart >= windowMs) {
    rateLimitStore.set(identifier, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  // Within existing window
  if (entry.count >= maxRequests) {
    const resetAt = entry.windowStart + windowMs;
    const retryAfterMs = resetAt - now;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterMs,
    };
  }

  // Increment count and allow
  entry.count++;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.windowStart + windowMs,
  };
}

/**
 * Rate limiter class for more complex scenarios.
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private prefix: string;

  constructor(config: RateLimitConfig, prefix: string = "ratelimit") {
    this.config = config;
    this.prefix = prefix;
  }

  /**
   * Check if a request is allowed for the given identifier.
   */
  check(identifier: string): RateLimitInfo {
    const key = `${this.prefix}:${identifier}`;
    return checkRateLimit(key, this.config);
  }

  /**
   * Get rate limit headers for the response.
   */
  getHeaders(info: RateLimitInfo): Record<string, string> {
    const headers: Record<string, string> = {
      "X-RateLimit-Limit": this.config.maxRequests.toString(),
      "X-RateLimit-Remaining": info.remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(info.resetAt / 1000).toString(),
    };

    if (!info.allowed && info.retryAfterMs) {
      headers["Retry-After"] = Math.ceil(info.retryAfterMs / 1000).toString();
    }

    return headers;
  }
}

// Pre-configured rate limiters

/**
 * Email API rate limiter: 10 emails per minute per user.
 */
export const emailRateLimiter = new RateLimiter(
  { maxRequests: 10, windowMs: 60 * 1000 },
  "email"
);

/**
 * General API rate limiter: 100 requests per minute.
 */
export const generalRateLimiter = new RateLimiter(
  { maxRequests: 100, windowMs: 60 * 1000 },
  "api"
);

/**
 * Strict rate limiter for sensitive operations: 5 per minute.
 */
export const strictRateLimiter = new RateLimiter(
  { maxRequests: 5, windowMs: 60 * 1000 },
  "strict"
);

/**
 * Get a unique identifier from request.
 * Uses X-Forwarded-For header or falls back to a generic key.
 */
export function getRequestIdentifier(request: Request): string {
  // Try to get user identifier from various headers
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");

  // Return the first available identifier
  const ip = cfIp || realIp || forwarded?.split(",")[0]?.trim();

  return ip || "anonymous";
}

/**
 * Helper to create a 429 Too Many Requests response.
 */
export function createRateLimitResponse(
  limiter: RateLimiter,
  info: RateLimitInfo
): Response {
  const headers = limiter.getHeaders(info);
  const retryAfterSeconds = info.retryAfterMs
    ? Math.ceil(info.retryAfterMs / 1000)
    : 60;

  return new Response(
    JSON.stringify({
      error: `Te veel verzoeken. Probeer het over ${retryAfterSeconds} seconden opnieuw.`,
      retryAfter: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    }
  );
}
