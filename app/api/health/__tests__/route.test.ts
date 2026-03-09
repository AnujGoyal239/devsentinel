/**
 * Health Check Endpoint Tests
 * 
 * Tests for the /api/health endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';

// Mock Redis client
vi.mock('@/lib/redis/client', () => ({
  redis: {
    ping: vi.fn(),
  },
}));

describe('Health Check Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return 200 status when all services are healthy', async () => {
      const { redis } = await import('@/lib/redis/client');
      (redis.ping as any).mockResolvedValue('PONG');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.services.api).toBe('up');
      expect(data.services.redis).toBe('up');
      expect(data.timestamp).toBeDefined();
    });

    it('should return 503 status when Redis is down', async () => {
      const { redis } = await import('@/lib/redis/client');
      (redis.ping as any).mockRejectedValue(new Error('Connection failed'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.services.api).toBe('up');
      expect(data.services.redis).toBe('down');
      expect(data.error).toBeDefined();
    });

    it('should include timestamp in response', async () => {
      const { redis } = await import('@/lib/redis/client');
      (redis.ping as any).mockResolvedValue('PONG');

      const response = await GET();
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should check Redis connectivity', async () => {
      const { redis } = await import('@/lib/redis/client');
      (redis.ping as any).mockResolvedValue('PONG');

      await GET();

      expect(redis.ping).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const { redis } = await import('@/lib/redis/client');
      const errorMessage = 'Redis connection timeout';
      (redis.ping as any).mockRejectedValue(new Error(errorMessage));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe(errorMessage);
    });

    it('should return service status for each component', async () => {
      const { redis } = await import('@/lib/redis/client');
      (redis.ping as any).mockResolvedValue('PONG');

      const response = await GET();
      const data = await response.json();

      expect(data.services).toBeDefined();
      expect(data.services.api).toBeDefined();
      expect(data.services.redis).toBeDefined();
    });
  });
});
