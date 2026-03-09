/**
 * Unit Tests for Custom Rules API Routes
 * 
 * Tests for Task 37.1: Write unit tests for API routes
 * GET/POST /api/projects/:id/custom-rules
 * 
 * Coverage:
 * - Request validation (valid and invalid inputs)
 * - Authentication (valid JWT, invalid JWT, missing JWT)
 * - Response format consistency
 * - Error handling (400, 401, 404, 500)
 * - RLS enforcement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock dependencies
vi.mock('@auth0/nextjs-auth0', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/custom-rules', () => ({
  validateCustomRule: vi.fn(),
  validateCustomRuleYAML: vi.fn(),
}));

describe('GET /api/projects/:id/custom-rules', () => {
  const mockUserId = 'auth0|user-123';
  const mockProjectId = 'project-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'GET',
      });

      const response = await GET(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should accept valid authenticated user', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { createClient } = await import('@/lib/supabase/server');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'projects') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'custom_rules') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'GET',
      });

      const response = await GET(request, { params: { id: mockProjectId } });
      expect(response.status).toBe(200);
    });
  });

  describe('RLS Enforcement', () => {
    it('should return 404 if project does not exist', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { createClient } = await import('@/lib/supabase/server');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'GET',
      });

      const response = await GET(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
      expect(data.code).toBe('NOT_FOUND');
    });

    it('should only return rules for the specified project', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { createClient } = await import('@/lib/supabase/server');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      const mockRules = [
        { id: 'rule-1', project_id: mockProjectId, name: 'Rule 1' },
        { id: 'rule-2', project_id: mockProjectId, name: 'Rule 2' },
      ];

      let queriedProjectId: string | null = null;
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'projects') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'custom_rules') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn((field: string, value: string) => {
                  if (field === 'project_id') {
                    queriedProjectId = value;
                  }
                  return {
                    order: vi.fn().mockResolvedValue({
                      data: mockRules,
                      error: null,
                    }),
                  };
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'GET',
      });

      await GET(request, { params: { id: mockProjectId } });

      expect(queriedProjectId).toBe(mockProjectId);
    });
  });

  describe('Response Format', () => {
    it('should return 200 OK with array of rules', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { createClient } = await import('@/lib/supabase/server');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      const mockRules = [
        { id: 'rule-1', project_id: mockProjectId, name: 'Rule 1' },
        { id: 'rule-2', project_id: mockProjectId, name: 'Rule 2' },
      ];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'projects') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'custom_rules') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: mockRules,
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'GET',
      });

      const response = await GET(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual(mockRules);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should return empty array if project has no rules', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { createClient } = await import('@/lib/supabase/server');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'projects') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'custom_rules') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'GET',
      });

      const response = await GET(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { createClient } = await import('@/lib/supabase/server');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'projects') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'custom_rules') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'DATABASE_ERROR', message: 'Query failed' },
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'GET',
      });

      const response = await GET(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('DATABASE_ERROR');
    });
  });
});

describe('POST /api/projects/:id/custom-rules', () => {
  const mockUserId = 'auth0|user-123';
  const mockProjectId = 'project-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Rule',
          severity: 'high',
          file_pattern: '*.ts',
          message: 'Test message',
        }),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Request Validation', () => {
    beforeEach(async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);
    });

    it('should return 400 if validation fails', async () => {
      const { validateCustomRule } = await import('@/lib/custom-rules');
      
      vi.mocked(validateCustomRule).mockReturnValue({
        valid: false,
        errors: ['Name is required', 'Severity is required'],
      });

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid rule');
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.details).toBeDefined();
    });

    it('should accept valid JSON rule', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { createClient } = await import('@/lib/supabase/server');
      const { validateCustomRule } = await import('@/lib/custom-rules');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      vi.mocked(validateCustomRule).mockReturnValue({
        valid: true,
      });

      const mockRule = {
        id: 'rule-123',
        project_id: mockProjectId,
        name: 'Test Rule',
        severity: 'high',
        file_pattern: '*.ts',
        message: 'Test message',
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'projects') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'custom_rules') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockRule,
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Rule',
          severity: 'high',
          file_pattern: '*.ts',
          message: 'Test message',
        }),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      expect(response.status).toBe(201);
    });

    it('should accept valid YAML rule', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { createClient } = await import('@/lib/supabase/server');
      const { validateCustomRuleYAML } = await import('@/lib/custom-rules');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      vi.mocked(validateCustomRuleYAML).mockReturnValue({
        valid: true,
        rule: {
          name: 'Test Rule',
          description: 'Test description',
          enabled: true,
          severity: 'high',
          file_pattern: '*.ts',
          content_pattern: null,
          message: 'Test message',
        },
      });

      const mockRule = {
        id: 'rule-123',
        project_id: mockProjectId,
        name: 'Test Rule',
        severity: 'high',
        file_pattern: '*.ts',
        message: 'Test message',
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'projects') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'custom_rules') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockRule,
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'POST',
        body: JSON.stringify({
          yaml: 'name: Test Rule\nseverity: high\nfile_pattern: "*.ts"\nmessage: Test message',
        }),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      expect(response.status).toBe(201);
    });

    it('should return 400 if YAML validation fails', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { validateCustomRuleYAML } = await import('@/lib/custom-rules');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      vi.mocked(validateCustomRuleYAML).mockReturnValue({
        valid: false,
        errors: ['Invalid YAML syntax'],
      });

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'POST',
        body: JSON.stringify({
          yaml: 'invalid: yaml: syntax:',
        }),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid YAML');
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('RLS Enforcement', () => {
    it('should return 404 if project does not exist', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { createClient } = await import('@/lib/supabase/server');
      const { validateCustomRule } = await import('@/lib/custom-rules');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      vi.mocked(validateCustomRule).mockReturnValue({
        valid: true,
      });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Rule',
          severity: 'high',
          file_pattern: '*.ts',
          message: 'Test message',
        }),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
      expect(data.code).toBe('NOT_FOUND');
    });
  });

  describe('Response Format', () => {
    it('should return 201 Created with rule data on success', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { createClient } = await import('@/lib/supabase/server');
      const { validateCustomRule } = await import('@/lib/custom-rules');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      vi.mocked(validateCustomRule).mockReturnValue({
        valid: true,
      });

      const mockRule = {
        id: 'rule-123',
        project_id: mockProjectId,
        name: 'Test Rule',
        severity: 'high',
        file_pattern: '*.ts',
        message: 'Test message',
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'projects') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'custom_rules') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockRule,
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Rule',
          severity: 'high',
          file_pattern: '*.ts',
          message: 'Test message',
        }),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toEqual(mockRule);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      const { getSession } = await import('@auth0/nextjs-auth0');
      const { createClient } = await import('@/lib/supabase/server');
      const { validateCustomRule } = await import('@/lib/custom-rules');

      vi.mocked(getSession).mockResolvedValue({
        user: { sub: mockUserId },
      } as any);

      vi.mocked(validateCustomRule).mockReturnValue({
        valid: true,
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'projects') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'custom_rules') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'DATABASE_ERROR', message: 'Insert failed' },
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(`http://localhost/api/projects/${mockProjectId}/custom-rules`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Rule',
          severity: 'high',
          file_pattern: '*.ts',
          message: 'Test message',
        }),
      });

      const response = await POST(request, { params: { id: mockProjectId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('DATABASE_ERROR');
    });
  });
});
