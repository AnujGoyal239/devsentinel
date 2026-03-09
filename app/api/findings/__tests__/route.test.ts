/**
 * Tests for Finding Update API Route
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from '../[id]/route';

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
    return new Response(JSON.stringify(data), { status });
  }),
  ApiErrors: {
    unauthorized: vi.fn((message, correlationId) => {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
    }),
    badRequest: vi.fn((message, correlationId) => {
      return new Response(JSON.stringify({ error: message, code: 'INVALID_STATUS' }), { status: 400 });
    }),
    notFound: vi.fn((message, correlationId) => {
      return new Response(JSON.stringify({ error: 'Finding not found', code: 'NOT_FOUND' }), { status: 404 });
    }),
    forbidden: vi.fn((message, correlationId) => {
      return new Response(JSON.stringify({ error: 'Forbidden', code: 'FORBIDDEN' }), { status: 403 });
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

describe('PATCH /api/findings/[id]', () => {
  const mockUserId = 'user-123';
  const mockFindingId = 'finding-456';
  const mockRunId = 'run-789';
  const mockProjectId = 'project-101';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    const { getCurrentUser } = await import('@/lib/auth/session');
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/findings/finding-456', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'pass' }),
    });

    const response = await PATCH(request, { params: { id: mockFindingId } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 if status is invalid', async () => {
    const { getCurrentUser } = await import('@/lib/auth/session');
    vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);

    const request = new NextRequest('http://localhost/api/findings/finding-456', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'invalid' }),
    });

    const response = await PATCH(request, { params: { id: mockFindingId } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid status');
    expect(data.code).toBe('INVALID_STATUS');
  });

  it('should return 404 if finding does not exist', async () => {
    const { getCurrentUser } = await import('@/lib/auth/session');
    const { supabase } = await import('@/lib/supabase/server');

    vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' },
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any);

    mockSelect.mockReturnValue({
      eq: mockEq,
    });

    mockEq.mockReturnValue({
      single: mockSingle,
    });

    const request = new NextRequest('http://localhost/api/findings/finding-456', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'pass' }),
    });

    const response = await PATCH(request, { params: { id: mockFindingId } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Finding not found');
    expect(data.code).toBe('NOT_FOUND');
  });

  it('should return 403 if finding does not belong to user', async () => {
    const { getCurrentUser } = await import('@/lib/auth/session');
    const { supabase } = await import('@/lib/supabase/server');

    vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);

    const mockFinding = {
      id: mockFindingId,
      status: 'fail',
      analysis_runs: {
        id: mockRunId,
        project_id: mockProjectId,
        projects: {
          id: mockProjectId,
          user_id: 'different-user-id',
        },
      },
    };

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockFinding,
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    } as any);

    mockSelect.mockReturnValue({
      eq: mockEq,
    });

    mockEq.mockReturnValue({
      single: mockSingle,
    });

    const request = new NextRequest('http://localhost/api/findings/finding-456', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'pass' }),
    });

    const response = await PATCH(request, { params: { id: mockFindingId } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Forbidden');
    expect(data.code).toBe('FORBIDDEN');
  });

  it('should successfully update finding and recalculate health score', async () => {
    const { getCurrentUser } = await import('@/lib/auth/session');
    const { supabase } = await import('@/lib/supabase/server');

    vi.mocked(getCurrentUser).mockResolvedValue({ id: mockUserId } as any);

    const mockFinding = {
      id: mockFindingId,
      status: 'fail',
      severity: 'high',
      analysis_runs: {
        id: mockRunId,
        project_id: mockProjectId,
        projects: {
          id: mockProjectId,
          user_id: mockUserId,
        },
      },
    };

    const mockFindings = [
      { severity: 'critical', status: 'fail' },
      { severity: 'high', status: 'fail' },
    ];

    let callCount = 0;
    const mockFrom = vi.fn((table: string) => {
      callCount++;
      
      // First call: fetch finding
      if (callCount === 1 && table === 'findings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockFinding,
                error: null,
              }),
            }),
          }),
        };
      }
      
      // Second call: update finding
      if (callCount === 2 && table === 'findings') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        };
      }
      
      // Third call: fetch findings for health score calculation
      if (callCount === 3 && table === 'findings') {
        const mockEq1 = vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockFindings,
            error: null,
          }),
        });
        
        return {
          select: vi.fn().mockReturnValue({
            eq: mockEq1,
          }),
        };
      }
      
      // Fourth call: update analysis run
      if (callCount === 4 && table === 'analysis_runs') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        };
      }
      
      // Fifth call: update project
      if (callCount === 5 && table === 'projects') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        };
      }

      return {} as any;
    });

    vi.mocked(supabase.from).mockImplementation(mockFrom as any);

    const request = new NextRequest('http://localhost/api/findings/finding-456', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'pass' }),
    });

    const response = await PATCH(request, { params: { id: mockFindingId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.finding_id).toBe(mockFindingId);
    expect(data.status).toBe('pass');
    expect(data.health_score).toBeDefined();
    expect(typeof data.health_score).toBe('number');
  });
});
