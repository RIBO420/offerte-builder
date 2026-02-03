/**
 * Upstash Redis-based Rate Limiter
 *
 * Distributed rate limiting using Upstash Redis with sliding window algorithm.
 * Works across multiple server instances and serverless deployments.
 *
 * Requires environment variables:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Check if Upstash is configured
export function isUpstashConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// Lazy initialization of Redis client to avoid errors when not configured
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    if (!isUpstashConfigured()) {
      throw new Error(
        "Upstash Redis is not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables."
      );
    }
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisClient;
}

// Lazy-initialized rate limiters
let _emailRateLimiter: Ratelimit | null = null;
let _apiRateLimiter: Ratelimit | null = null;
let _publicOfferteRateLimiter: Ratelimit | null = null;
let _strictRateLimiter: Ratelimit | null = null;

/**
 * Email rate limiter: 5 emails per hour per user.
 * Stricter than API rate limiting due to email costs and spam prevention.
 */
export function getEmailRateLimiter(): Ratelimit {
  if (!_emailRateLimiter) {
    _emailRateLimiter = new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(5, "1 h"), // 5 emails per hour
      analytics: true,
      prefix: "ratelimit:email",
    });
  }
  return _emailRateLimiter;
}

/**
 * General API rate limiter: 100 requests per minute.
 * For standard API endpoints.
 */
export function getApiRateLimiter(): Ratelimit {
  if (!_apiRateLimiter) {
    _apiRateLimiter = new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
      analytics: true,
      prefix: "ratelimit:api",
    });
  }
  return _apiRateLimiter;
}

/**
 * Public offerte rate limiter: 30 requests per minute.
 * For public offerte access endpoints to prevent brute-force attacks.
 */
export function getPublicOfferteRateLimiter(): Ratelimit {
  if (!_publicOfferteRateLimiter) {
    _publicOfferteRateLimiter = new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(30, "1 m"), // 30 requests per minute
      analytics: true,
      prefix: "ratelimit:public-offerte",
    });
  }
  return _publicOfferteRateLimiter;
}

/**
 * Strict rate limiter: 5 requests per minute.
 * For sensitive operations like password changes, account deletions.
 */
export function getStrictRateLimiter(): Ratelimit {
  if (!_strictRateLimiter) {
    _strictRateLimiter = new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 requests per minute
      analytics: true,
      prefix: "ratelimit:strict",
    });
  }
  return _strictRateLimiter;
}

/**
 * Result from Upstash rate limit check.
 */
export interface UpstashRateLimitResult {
  success: boolean;
  remaining: number;
  reset: number; // Timestamp when the window resets
  limit: number;
}

/**
 * Check rate limit using Upstash Redis.
 *
 * @param limiter - The Ratelimit instance to use
 * @param identifier - Unique identifier (e.g., user ID, IP address)
 * @returns Rate limit result with success status and remaining quota
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<UpstashRateLimitResult> {
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
    limit: result.limit,
  };
}

/**
 * Get rate limit headers for HTTP responses.
 */
export function getRateLimitHeaders(
  result: UpstashRateLimitResult
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.reset / 1000).toString(),
  };

  if (!result.success) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000)
    );
    headers["Retry-After"] = retryAfterSeconds.toString();
  }

  return headers;
}

/**
 * Create a 429 Too Many Requests response for rate limited requests.
 */
export function createUpstashRateLimitResponse(
  result: UpstashRateLimitResult
): Response {
  const headers = getRateLimitHeaders(result);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((result.reset - Date.now()) / 1000)
  );

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

/**
 * Get a unique identifier from a request.
 * Uses various headers to determine the client's IP address.
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
