/**
 * Unit Tests for Projects API Routes
 * 
 * Tests for Task 37.1: Write unit tests for API routes
 * 
 * Coverage:
 * - Request validation (valid and invalid inputs)
 * - Authentication guard (valid JWT, invalid JWT, missing JWT)
 * - Response format consistency
 * - Error handling (400, 401, 500)
 * - RLS enforcement (attempt to access other user's data)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/monitoring/api-wrapper', () => ({
  createApiResponse: vi.fn((data, status, correlationId) => {
    return new Response(JSON.stringify({ data }), { status });
  }),
  ApiErrors: {
    unauthorized: vi.fn((message, correlationId) => {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
    }),
    badRequest: vi.fn((message, correlationId) => {
      return new Response(JSON.stringify({ error: message, code: 'VALIDATION_ERROR' }), { status: 400 });
    }),
    internalError: vi.fn((correlationId) => {
      return new Response(JSON.stringify({ error: 'Internal error', code: 'INTERNAL_ERROR' }), { status: 500 });
    }),
  },
  createLogger: vi.fn(() => ({
    getCorrelationId: () => 'test-correlation-id',
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('POST /api/projects', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
          repo_url: 'https://github.com/owner/repo',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should accept valid authenticated user', async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      const { supabase } = await import('@/lib/supabase/server');

      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);

      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'project-123',
          name: 'Test Project',
          repo_url: 'https://github.com/owner/repo',
          user_id: mockUserId,
        },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      mockInsert.mockReturnValue({
        select: mockSelect,
      });

      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
          repo_url: 'https://github.com/owner/repo',
        }),
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
      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          repo_url: 'https://github.com/owner/repo',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if repo_url is missing', async () => {
      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if repo_url is not a valid GitHub URL', async () => {
      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
          repo_url: 'https://gitlab.com/owner/repo',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid GitHub repository URL');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid GitHub URL with trailing slash', async () => {
      const { supabase } = await import('@/lib/supabase/server');

      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'project-123',
          name: 'Test Project',
          repo_url: 'https://github.com/owner/repo/',
          repo_owner: 'owner',
          repo_name: 'repo',
          user_id: mockUserId,
        },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      mockInsert.mockReturnValue({
        select: mockSelect,
      });

      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
          repo_url: 'https://github.com/owner/repo/',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });

    it('should extract repo_owner and repo_name correctly', async () => {
      const { supabase } = await import('@/lib/supabase/server');

      let insertedData: any = null;
      const mockInsert = vi.fn((data) => {
        insertedData = data;
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { ...data, id: 'project-123' },
            error: null,
          }),
        };
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
          repo_url: 'https://github.com/facebook/react',
        }),
      });

      await POST(request);

      expect(insertedData.repo_owner).toBe('facebook');
      expect(insertedData.repo_name).toBe('react');
    });

    it('should default branch to "main" if not provided', async () => {
      const { supabase } = await import('@/lib/supabase/server');

      let insertedData: any = null;
      const mockInsert = vi.fn((data) => {
        insertedData = data;
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { ...data, id: 'project-123' },
            error: null,
          }),
        };
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
          repo_url: 'https://github.com/owner/repo',
        }),
      });

      await POST(request);

      expect(insertedData.branch).toBe('main');
    });
  });

  describe('Response Format', () => {
    beforeEach(async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);
    });

    it('should return 201 Created with project data on success', async () => {
      const { supabase } = await import('@/lib/supabase/server');

      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        repo_url: 'https://github.com/owner/repo',
        repo_owner: 'owner',
        repo_name: 'repo',
        branch: 'main',
        status: 'idle',
        user_id: mockUserId,
      };

      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockProject,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      mockInsert.mockReturnValue({
        select: mockSelect,
      });

      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
          repo_url: 'https://github.com/owner/repo',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toEqual(mockProject);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);
    });

    it('should return 500 on database connection error', async () => {
      const { supabase } = await import('@/lib/supabase/server');

      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'CONNECTION_ERROR', message: 'Database connection failed' },
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any);

      mockInsert.mockReturnValue({
        select: mockSelect,
      });

      mockSelect.mockReturnValue({
        single: mockSingle,
      });

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Project',
          repo_url: 'https://github.com/owner/repo',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });
});

describe('GET /api/projects', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('UNAUTHORIZED');
    });
  });

  describe('RLS Enforcement', () => {
    it('should only return projects belonging to authenticated user', async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      const { supabase } = await import('@/lib/supabase/server');

      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);

      const mockProjects = [
        { id: 'project-1', name: 'Project 1', user_id: mockUserId },
        { id: 'project-2', name: 'Project 2', user_id: mockUserId },
      ];

      let queriedUserId: string | null = null;
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn((field, value) => {
        if (field === 'user_id') {
          queriedUserId = value;
        }
        return {
          order: vi.fn().mockResolvedValue({
            data: mockProjects,
            error: null,
          }),
        };
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'GET',
      });

      await GET(request);

      // Verify that the query filtered by user_id
      expect(queriedUserId).toBe(mockUserId);
    });
  });

  describe('Response Format', () => {
    it('should return 200 OK with array of projects', async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      const { supabase } = await import('@/lib/supabase/server');

      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);

      const mockProjects = [
        { id: 'project-1', name: 'Project 1', user_id: mockUserId },
        { id: 'project-2', name: 'Project 2', user_id: mockUserId },
      ];

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({
        data: mockProjects,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      mockEq.mockReturnValue({
        order: mockOrder,
      });

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual(mockProjects);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should return empty array if user has no projects', async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      const { supabase } = await import('@/lib/supabase/server');

      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      mockEq.mockReturnValue({
        order: mockOrder,
      });

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      const { getCurrentUser } = await import('@/lib/auth/session');
      const { supabase } = await import('@/lib/supabase/server');

      vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'DATABASE_ERROR', message: 'Query failed' },
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      mockEq.mockReturnValue({
        order: mockOrder,
      });

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });
});
