/**
 * Upstash Redis Client
 * 
 * Serverless Redis client for rate limiting and caching.
 * Uses REST API (no persistent TCP connection required).
 */

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  throw new Error(
    'Missing Upstash Redis environment variables. ' +
    'Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
  );
}

/**
 * Upstash Redis client instance.
 * Use this for caching and custom Redis operations.
 */
export const redis = Redis.fromEnv();

/**
 * Rate limiter configuration.
 * Limits each authenticated user to 100 requests per minute.
 * 
 * @example
 * const { success } = await ratelimit.limit(userId);
 * if (!success) {
 *   return new Response('Too Many Requests', { status: 429 });
 * }
 */
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
  prefix: 'devsentinel:ratelimit',
});

/**
 * Cache helper functions
 */
export const cache = {
  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    return redis.get<T>(key);
  },

  /**
   * Set a cached value with optional TTL (in seconds)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (ttl) {
      await redis.setex(key, ttl, JSON.stringify(value));
    } else {
      await redis.set(key, JSON.stringify(value));
    }
  },

  /**
   * Delete a cached value
   */
  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key);
    return result === 1;
  },
};
