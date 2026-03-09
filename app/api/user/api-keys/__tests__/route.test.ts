/**
 * Unit Tests for API Keys Management Routes
 * 
 * Tests for Task 37.1: Write unit tests for API routes
 * GET/POST /api/user/api-keys
 * 
 * Coverage:
 * - Request validation (valid and invalid inputs)
 * - Authentication (valid JWT, invalid JWT, missing JWT)
 * - Response format consistency
 * - Error handling (400, 401, 409, 500)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock dependencies
vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/auth/api-keys', () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
}));

describe('POST /api/user/api-keys', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/user/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should accept valid authenticated user', async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      const { createApiKey } = await import('@/lib/auth/api-keys');

      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);
      vi.mocked(createApiKey).mockResolvedValue({
        id: 'key-123',
        name: 'Test Key',
        key: 'ds_test_1234567890abcdef',
        key_prefix: 'ds_test_1234',
        created_at: new Date().toISOString(),
      } as any);

      const request = new NextRequest('http://localhost/api/user/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });
  });

  describe('Request Validation', () => {
    beforeEach(async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);
    });

    it('should return 400 if name is missing', async () => {
      const request = new NextRequest('http://localhost/api/user/api-keys', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if name is empty string', async () => {
      const request = new NextRequest('http://localhost/api/user/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if name exceeds 100 characters', async () => {
      const longName = 'a'.repeat(101);
      const request = new NextRequest('http://localhost/api/user/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: longName }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('less than 100 characters');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if name contains invalid characters', async () => {
      const request = new NextRequest('http://localhost/api/user/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test@Key!' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('letters, numbers, spaces, hyphens, and underscores');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid name with letters, numbers, spaces, hyphens, and underscores', async () => {
      const { createApiKey } = await import('@/lib/auth/api-keys');

      vi.mocked(createApiKey).mockResolvedValue({
        id: 'key-123',
        name: 'Test Key-123_v2',
        key: 'ds_test_1234567890abcdef',
        key_prefix: 'ds_test_1234',
        created_at: new Date().toISOString(),
      } as any);

      const request = new NextRequest('http://localhost/api/user/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key-123_v2' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });
  });

  describe('Response Format', () => {
    beforeEach(async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);
    });

    it('should return 201 Created with full API key on success', async () => {
      const { createApiKey } = await import('@/lib/auth/api-keys');

      const mockApiKey = {
        id: 'key-123',
        name: 'Test Key',
        key: 'ds_test_1234567890abcdef',
        key_prefix: 'ds_test_1234',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(createApiKey).mockResolvedValue(mockApiKey as any);

      const request = new NextRequest('http://localhost/api/user/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.id).toBe(mockApiKey.id);
      expect(data.data.name).toBe(mockApiKey.name);
      expect(data.data.key).toBe(mockApiKey.key); // Full key returned only once
      expect(data.data.key_prefix).toBe(mockApiKey.key_prefix);
      expect(data.data.created_at).toBe(mockApiKey.created_at);
    });

    it('should include full plaintext key in response (only time visible)', async () => {
      const { createApiKey } = await import('@/lib/auth/api-keys');

      const mockApiKey = {
        id: 'key-123',
        name: 'Test Key',
        key: 'ds_test_1234567890abcdef',
        key_prefix: 'ds_test_1234',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(createApiKey).mockResolvedValue(mockApiKey as any);

      const request = new NextRequest('http://localhost/api/user/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.key).toBeDefined();
      expect(data.data.key).toBe('ds_test_1234567890abcdef');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);
    });

    it('should return 409 on duplicate name error', async () => {
      const { createApiKey } = await import('@/lib/auth/api-keys');

      vi.mocked(createApiKey).mockRejectedValue(
        new Error('duplicate key value violates unique constraint "unique_user_key_name"')
      );

      const request = new NextRequest('http://localhost/api/user/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Existing Key' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists');
      expect(data.code).toBe('DUPLICATE_NAME');
    });

    it('should return 500 on database error', async () => {
      const { createApiKey } = await import('@/lib/auth/api-keys');

      vi.mocked(createApiKey).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/user/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create API key');
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });
});

describe('GET /api/user/api-keys', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should accept valid authenticated user', async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      const { listApiKeys } = await import('@/lib/auth/api-keys');

      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);
      vi.mocked(listApiKeys).mockResolvedValue([]);

      const response = await GET();
      expect(response.status).toBe(200);
    });
  });

  describe('Response Format', () => {
    beforeEach(async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);
    });

    it('should return 200 OK with array of API keys', async () => {
      const { listApiKeys } = await import('@/lib/auth/api-keys');

      const mockKeys = [
        {
          id: 'key-1',
          name: 'Key 1',
          key_prefix: 'ds_test_1234',
          last_used_at: null,
          created_at: '2024-01-01T00:00:00Z',
          revoked_at: null,
        },
        {
          id: 'key-2',
          name: 'Key 2',
          key_prefix: 'ds_test_5678',
          last_used_at: '2024-01-02T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          revoked_at: null,
        },
      ];

      vi.mocked(listApiKeys).mockResolvedValue(mockKeys as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should not include full key values in response', async () => {
      const { listApiKeys } = await import('@/lib/auth/api-keys');

      const mockKeys = [
        {
          id: 'key-1',
          name: 'Key 1',
          key_prefix: 'ds_test_1234',
          last_used_at: null,
          created_at: '2024-01-01T00:00:00Z',
          revoked_at: null,
        },
      ];

      vi.mocked(listApiKeys).mockResolvedValue(mockKeys as any);

      const response = await GET();
      const data = await response.json();

      expect(data.data[0].key).toBeUndefined();
      expect(data.data[0].key_prefix).toBeDefined();
    });

    it('should include is_active status based on revoked_at', async () => {
      const { listApiKeys } = await import('@/lib/auth/api-keys');

      const mockKeys = [
        {
          id: 'key-1',
          name: 'Active Key',
          key_prefix: 'ds_test_1234',
          last_used_at: null,
          created_at: '2024-01-01T00:00:00Z',
          revoked_at: null,
        },
        {
          id: 'key-2',
          name: 'Revoked Key',
          key_prefix: 'ds_test_5678',
          last_used_at: null,
          created_at: '2024-01-01T00:00:00Z',
          revoked_at: '2024-01-02T00:00:00Z',
        },
      ];

      vi.mocked(listApiKeys).mockResolvedValue(mockKeys as any);

      const response = await GET();
      const data = await response.json();

      expect(data.data[0].is_active).toBe(true);
      expect(data.data[1].is_active).toBe(false);
    });

    it('should return empty array if user has no API keys', async () => {
      const { listApiKeys } = await import('@/lib/auth/api-keys');

      vi.mocked(listApiKeys).mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
    });

    it('should include all required fields for each key', async () => {
      const { listApiKeys } = await import('@/lib/auth/api-keys');

      const mockKeys = [
        {
          id: 'key-1',
          name: 'Test Key',
          key_prefix: 'ds_test_1234',
          last_used_at: '2024-01-02T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          revoked_at: null,
        },
      ];

      vi.mocked(listApiKeys).mockResolvedValue(mockKeys as any);

      const response = await GET();
      const data = await response.json();

      const key = data.data[0];
      expect(key.id).toBeDefined();
      expect(key.name).toBeDefined();
      expect(key.key_prefix).toBeDefined();
      expect(key.last_used_at).toBeDefined();
      expect(key.created_at).toBeDefined();
      expect(key.revoked_at).toBeDefined();
      expect(key.is_active).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);
    });

    it('should return 500 on database error', async () => {
      const { listApiKeys } = await import('@/lib/auth/api-keys');

      vi.mocked(listApiKeys).mockRejectedValue(new Error('Database connection failed'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to list API keys');
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });
});
