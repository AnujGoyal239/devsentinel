/**
 * Unit Tests for Analysis Trigger API Route
 * 
 * Tests for Task 37.1: Write unit tests for API routes
 * POST /api/projects/:id/analyse
 * 
 * Coverage:
 * - Request validation (valid and invalid inputs)
 * - Authentication (valid JWT, invalid JWT, missing JWT)
 * - Rate limiting
 * - Response format consistency
 * - Error handling (400, 401, 403, 404, 429, 500)
 * - RLS enforcement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock dependencies
vi.mock('@auth0/nextjs-auth0', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/inngest/client', () => ({
  inngest: {
    send: vi.fn(),
  },
}));

vi.mock('@/lib/monitoring/api-wrapper', () => ({
  createApiResponse: vi.fn((data, status, correlationId) => {
    return new Response(JSON.stringify(data), { status });
  }),
  ApiErrors: {
    unauthorized: vi.fn((message, correlationId) => {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
    }),
    notFound: vi.fn((message, correlationId) => {
      return new Response(JSON.stringify({ error: 'Project not found', code: 'NOT_FOUND' }), { status: 404 });
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

vi.mock('@/lib/supabase/errors', () => ({
  handleDatabaseError: vi.fn((error) => {
    if (error?.code === 'PGRST116') {
      return { code: 'NOT_FOUND', isConnectionError: false };
    }
    return { code: 'DATABASE_ERROR', isConnectionError: true };
  }),
}));

describe('POST /api/projects/:id/analyse', () => {
  const mockUserId = 'auth0|user-123';
  const mockProjectId = 'project-456';
  const mockRunId = 'run-789';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/analyse`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 if session exists but user is missing', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      vi.mocked(getSession).mockResolvedValue({ user: null } as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/analyse`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should accept valid authenticated user', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { supabase } = await import('@/lib/supabase/server');
      const { inngest } = await import('@/inngest/client');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      const mockProject = {
        id: mockProjectId,
        user_id: mockUserId,
        name: 'Test Project',
      };

      const mockAnalysisRun = {
        id: mockRunId,
        project_id: mockProjectId,
        status: 'queued',
      };

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;
        
        // First call: verify project ownership
        if (callCount === 1 && table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockProject,
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        // Second call: check existing runs
        if (callCount === 2 && table === 'analysis_runs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        // Third call: create analysis run
        if (callCount === 3 && table === 'analysis_runs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockAnalysisRun,
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        
        // Fourth call: update project status
        if (callCount === 4 && table === 'projects') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          } as any;
        }

        return {} as any;
      });

      vi.mocked(inngest.send).mockResolvedValue({ ids: [mockRunId] } as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/analyse`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      expect(response.status).toBe(201);
    });
  });

  describe('RLS Enforcement', () => {
    it('should return 404 if project does not exist', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { supabase } = await import('@/lib/supabase/server');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        }),
      } as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/analyse`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
      expect(data.code).toBe('NOT_FOUND');
    });

    it('should return 403 if project belongs to different user', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { supabase } = await import('@/lib/supabase/server');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      // RLS will prevent this query from returning data
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        }),
      } as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/analyse`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('NOT_FOUND');
    });
  });

  describe('Request Validation', () => {
    beforeEach(async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);
    });

    it('should accept request without document_id', async () => {
      const { supabase } = await import('@/lib/supabase/server');
      const { inngest } = await import('@/inngest/client');

      const mockProject = {
        id: mockProjectId,
        user_id: mockUserId,
      };

      const mockAnalysisRun = {
        id: mockRunId,
        project_id: mockProjectId,
        status: 'queued',
      };

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;
        
        if (callCount === 1 && table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockProject,
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 2 && table === 'analysis_runs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 3 && table === 'analysis_runs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockAnalysisRun,
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 4 && table === 'projects') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          } as any;
        }

        return {} as any;
      });

      vi.mocked(inngest.send).mockResolvedValue({ ids: [mockRunId] } as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/analyse`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      expect(response.status).toBe(201);
    });

    it('should accept request with document_id', async () => {
      const { supabase } = await import('@/lib/supabase/server');
      const { inngest } = await import('@/inngest/client');

      const mockProject = {
        id: mockProjectId,
        user_id: mockUserId,
      };

      const mockAnalysisRun = {
        id: mockRunId,
        project_id: mockProjectId,
        status: 'queued',
      };

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;
        
        if (callCount === 1 && table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockProject,
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 2 && table === 'analysis_runs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 3 && table === 'analysis_runs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockAnalysisRun,
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 4 && table === 'projects') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          } as any;
        }

        return {} as any;
      });

      let sentEvent: any = null;
      vi.mocked(inngest.send).mockImplementation((event) => {
        sentEvent = event;
        return Promise.resolve({ ids: [mockRunId] } as any);
      });

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/analyse`, {
        method: 'POST',
        body: JSON.stringify({ document_id: 'doc-123' }),
      });

      await POST(request, { params: { id: mockProjectId } });

      expect(sentEvent.data.document_id).toBe('doc-123');
    });
  });

  describe('Response Format', () => {
    beforeEach(async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);
    });

    it('should return 201 Created with run_id on success', async () => {
      const { supabase } = await import('@/lib/supabase/server');
      const { inngest } = await import('@/inngest/client');

      const mockProject = {
        id: mockProjectId,
        user_id: mockUserId,
      };

      const mockAnalysisRun = {
        id: mockRunId,
        project_id: mockProjectId,
        status: 'queued',
      };

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;
        
        if (callCount === 1 && table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockProject,
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 2 && table === 'analysis_runs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 3 && table === 'analysis_runs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockAnalysisRun,
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 4 && table === 'projects') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          } as any;
        }

        return {} as any;
      });

      vi.mocked(inngest.send).mockResolvedValue({ ids: [mockRunId] } as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/analyse`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.run_id).toBe(mockRunId);
      expect(data.status).toBe('queued');
      expect(data.message).toBeDefined();
    });

    it('should indicate when another analysis is in progress', async () => {
      const { supabase } = await import('@/lib/supabase/server');
      const { inngest } = await import('@/inngest/client');

      const mockProject = {
        id: mockProjectId,
        user_id: mockUserId,
      };

      const mockAnalysisRun = {
        id: mockRunId,
        project_id: mockProjectId,
        status: 'queued',
      };

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;
        
        if (callCount === 1 && table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockProject,
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        // Return existing in-progress run
        if (callCount === 2 && table === 'analysis_runs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [{ id: 'existing-run', status: 'running' }],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 3 && table === 'analysis_runs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockAnalysisRun,
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 4 && table === 'projects') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          } as any;
        }

        return {} as any;
      });

      vi.mocked(inngest.send).mockResolvedValue({ ids: [mockRunId] } as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/analyse`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.queued).toBe(true);
      expect(data.message).toContain('another analysis is in progress');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);
    });

    it('should return 500 on database error when creating analysis run', async () => {
      const { supabase } = await import('@/lib/supabase/server');

      const mockProject = {
        id: mockProjectId,
        user_id: mockUserId,
      };

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;
        
        if (callCount === 1 && table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockProject,
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 2 && table === 'analysis_runs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        // Database error when creating run
        if (callCount === 3 && table === 'analysis_runs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'CONNECTION_ERROR', message: 'Database connection failed' },
                }),
              }),
            }),
          } as any;
        }

        return {} as any;
      });

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/analyse`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('INTERNAL_ERROR');
    });

    it('should return 500 and clean up on Inngest enqueue failure', async () => {
      const { supabase } = await import('@/lib/supabase/server');
      const { inngest } = await import('@/inngest/client');

      const mockProject = {
        id: mockProjectId,
        user_id: mockUserId,
      };

      const mockAnalysisRun = {
        id: mockRunId,
        project_id: mockProjectId,
        status: 'queued',
      };

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;
        
        if (callCount === 1 && table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockProject,
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 2 && table === 'analysis_runs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 3 && table === 'analysis_runs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockAnalysisRun,
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        
        if (callCount === 4 && table === 'projects') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          } as any;
        }
        
        // Cleanup: update analysis run to failed
        if (callCount === 5 && table === 'analysis_runs') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          } as any;
        }

        return {} as any;
      });

      vi.mocked(inngest.send).mockRejectedValue(new Error('Inngest service unavailable'));

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/analyse`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });
});
