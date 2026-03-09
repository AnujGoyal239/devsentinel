/**
 * Unit Tests for GitHub Webhook Endpoint
 * 
 * Tests for Task 37.1: Write unit tests for API routes
 * POST/GET /api/webhooks/github
 * 
 * Coverage:
 * - Request validation (valid and invalid inputs)
 * - Authentication (signature verification)
 * - Response format consistency
 * - Error handling (401, 500)
 * - Event handling (push, pull_request, release, ping)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';
import { createHmac, timingSafeEqual } from 'crypto';

// Mock crypto.timingSafeEqual for test environment
if (!global.crypto) {
  global.crypto = {} as any;
}
if (!global.crypto.timingSafeEqual) {
  (global.crypto as any).timingSafeEqual = (a: Buffer, b: Buffer) => {
    if (a.length !== b.length) return false;
    return a.equals(b);
  };
}

// Mock dependencies
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('@/inngest/client', () => ({
  inngest: {
    send: vi.fn(),
  },
}));

vi.mock('@/lib/monitoring/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Helper function to generate valid signature
function generateSignature(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

describe('POST /api/webhooks/github', () => {
  const WEBHOOK_SECRET = 'test-webhook-secret';
  const mockProjectId = 'project-123';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  describe('Signature Verification', () => {
    it('should return 401 if signature is missing', async () => {
      const payload = JSON.stringify({ action: 'opened' });
      
      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'push',
          'x-github-delivery': 'delivery-123',
        },
        body: payload,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
    });

    it('should return 401 if signature is invalid', async () => {
      const payload = JSON.stringify({ action: 'opened' });
      
      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'push',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': 'sha256=invalid_signature',
        },
        body: payload,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
    });

    it('should return 401 if signature algorithm is not sha256', async () => {
      const payload = JSON.stringify({ action: 'opened' });
      
      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'push',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': 'sha1=somehash',
        },
        body: payload,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid signature');
    });

    it('should accept valid signature', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');
      const { inngest } = await import('@/inngest/client');

      const payload = JSON.stringify({
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo',
        },
        after: 'abc123',
      });
      
      const signature = generateSignature(payload, WEBHOOK_SECRET);

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: mockProjectId },
                error: null,
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'run-123' },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      } as any);

      vi.mocked(inngest.send).mockResolvedValue({ ids: ['run-123'] } as any);

      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'push',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': signature,
        },
        body: payload,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Event Handling - Push', () => {
    it('should handle push event and trigger analysis', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');
      const { inngest } = await import('@/inngest/client');

      const payload = JSON.stringify({
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo',
        },
        after: 'abc123def456',
      });
      
      const signature = generateSignature(payload, WEBHOOK_SECRET);

      let sentEvent: any = null;
      vi.mocked(inngest.send).mockImplementation((event) => {
        sentEvent = event;
        return Promise.resolve({ ids: ['run-123'] } as any);
      });

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        if (table === 'analysis_runs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'run-123' },
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        if (table === 'projects') {
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

      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'push',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': signature,
        },
        body: payload,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.event).toBe('push');
      expect(data.project_id).toBe(mockProjectId);
      expect(data.commit_sha).toBe('abc123def456');
      expect(sentEvent.name).toBe('analysis/run');
    });

    it('should return success if no project found for repository', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');

      const payload = JSON.stringify({
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo',
        },
        after: 'abc123',
      });
      
      const signature = generateSignature(payload, WEBHOOK_SECRET);

      vi.mocked(supabaseAdmin.from).mockReturnValue({
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

      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'push',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': signature,
        },
        body: payload,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('No project configured');
    });
  });

  describe('Event Handling - Pull Request', () => {
    it('should handle pull_request opened event', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');
      const { inngest } = await import('@/inngest/client');

      const payload = JSON.stringify({
        action: 'opened',
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo',
        },
        pull_request: {
          head: {
            sha: 'pr123abc',
          },
        },
      });
      
      const signature = generateSignature(payload, WEBHOOK_SECRET);

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        if (table === 'analysis_runs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'run-123' },
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        } as any;
      });

      vi.mocked(inngest.send).mockResolvedValue({ ids: ['run-123'] } as any);

      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'pull_request',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': signature,
        },
        body: payload,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.commit_sha).toBe('pr123abc');
    });

    it('should handle pull_request synchronize event', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');
      const { inngest } = await import('@/inngest/client');

      const payload = JSON.stringify({
        action: 'synchronize',
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo',
        },
        pull_request: {
          head: {
            sha: 'pr456def',
          },
        },
      });
      
      const signature = generateSignature(payload, WEBHOOK_SECRET);

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        if (table === 'analysis_runs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'run-123' },
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        } as any;
      });

      vi.mocked(inngest.send).mockResolvedValue({ ids: ['run-123'] } as any);

      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'pull_request',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': signature,
        },
        body: payload,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should ignore pull_request closed event', async () => {
      const payload = JSON.stringify({
        action: 'closed',
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo',
        },
        pull_request: {
          head: {
            sha: 'pr789ghi',
          },
        },
      });
      
      const signature = generateSignature(payload, WEBHOOK_SECRET);

      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'pull_request',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': signature,
        },
        body: payload,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('No project configured');
    });
  });

  describe('Event Handling - Release', () => {
    it('should handle release published event', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');
      const { inngest } = await import('@/inngest/client');

      const payload = JSON.stringify({
        action: 'published',
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo',
        },
        release: {
          target_commitish: 'release123',
        },
      });
      
      const signature = generateSignature(payload, WEBHOOK_SECRET);

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        if (table === 'analysis_runs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'run-123' },
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        } as any;
      });

      vi.mocked(inngest.send).mockResolvedValue({ ids: ['run-123'] } as any);

      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'release',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': signature,
        },
        body: payload,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.commit_sha).toBe('release123');
    });
  });

  describe('Event Handling - Ping', () => {
    it('should handle ping event', async () => {
      const payload = JSON.stringify({
        zen: 'Design for failure.',
        hook_id: 123,
      });
      
      const signature = generateSignature(payload, WEBHOOK_SECRET);

      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'ping',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': signature,
        },
        body: payload,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Webhook configured successfully');
    });
  });

  describe('Event Handling - Unsupported', () => {
    it('should return success for unsupported event types', async () => {
      const payload = JSON.stringify({
        action: 'created',
      });
      
      const signature = generateSignature(payload, WEBHOOK_SECRET);

      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'issues',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': signature,
        },
        body: payload,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('not handled');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');

      const payload = JSON.stringify({
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo',
        },
        after: 'abc123',
      });
      
      const signature = generateSignature(payload, WEBHOOK_SECRET);

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockRejectedValue(new Error('Database connection failed')),
            }),
          }),
        }),
      } as any);

      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'push',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': signature,
        },
        body: payload,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should return 500 on Inngest error', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');
      const { inngest } = await import('@/inngest/client');

      const payload = JSON.stringify({
        repository: {
          owner: { login: 'testowner' },
          name: 'testrepo',
        },
        after: 'abc123',
      });
      
      const signature = generateSignature(payload, WEBHOOK_SECRET);

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: mockProjectId },
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        if (table === 'analysis_runs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'run-123' },
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        } as any;
      });

      vi.mocked(inngest.send).mockRejectedValue(new Error('Inngest service unavailable'));

      const request = new NextRequest('http://localhost/api/webhooks/github', {
        method: 'POST',
        headers: {
          'x-github-event': 'push',
          'x-github-delivery': 'delivery-123',
          'x-hub-signature-256': signature,
        },
        body: payload,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});

describe('GET /api/webhooks/github', () => {
  it('should return webhook information', async () => {
    const request = new NextRequest('http://localhost/api/webhooks/github', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBeDefined();
    expect(data.supported_events).toBeDefined();
    expect(Array.isArray(data.supported_events)).toBe(true);
    expect(data.supported_events).toContain('push');
    expect(data.supported_events).toContain('pull_request');
    expect(data.supported_events).toContain('release');
  });
});
