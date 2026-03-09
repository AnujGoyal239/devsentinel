/**
 * GitHub Client Tests
 * 
 * Tests for GitHub REST API client functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis client
vi.mock('@/lib/redis/client', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
  },
}));

// Create mock functions
const mockGetTree = vi.fn();
const mockGetContent = vi.fn();

// Mock Octokit
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    git: {
      getTree: mockGetTree,
    },
    repos: {
      getContent: mockGetContent,
    },
  })),
}));

describe('GitHub Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchRepoTree', () => {
    it('should fetch and return file tree from GitHub', async () => {
      // Mock the getTree response
      mockGetTree.mockResolvedValue({
        data: {
          tree: [
            { path: 'src/index.ts', type: 'blob', sha: 'abc123' },
            { path: 'src/utils.ts', type: 'blob', sha: 'def456' },
            { path: 'src', type: 'tree', sha: 'ghi789' },
          ],
        },
      });

      const { fetchRepoTree } = await import('../client');
      const result = await fetchRepoTree('owner', 'repo', 'main', 'token');

      expect(result.files).toHaveLength(2); // Only blobs, not trees
      expect(result.total).toBe(2);
      expect(result.files[0].path).toBe('src/index.ts');
    });

    it('should handle GitHub API errors with retry', async () => {
      // Mock rate limit error
      mockGetTree.mockRejectedValue({
        status: 429,
        message: 'Rate limit exceeded',
      });

      const { fetchRepoTree } = await import('../client');
      await expect(
        fetchRepoTree('owner', 'repo', 'main', 'token')
      ).rejects.toThrow();
    }, 10000); // 10 second timeout for retry logic
  });

  describe('fetchFileContent', () => {
    it('should fetch and decode file content from GitHub', async () => {
      const content = 'console.log("Hello World");';
      const base64Content = Buffer.from(content).toString('base64');

      // Mock the getContent response
      mockGetContent.mockResolvedValue({
        data: {
          type: 'file',
          content: base64Content,
          encoding: 'base64',
        },
      });

      const { fetchFileContent } = await import('../client');
      const result = await fetchFileContent('owner', 'repo', 'src/index.ts', 'token');

      expect(result).toBe(content);
    });

    it('should throw error for non-file paths', async () => {
      // Mock directory response
      mockGetContent.mockResolvedValue({
        data: {
          type: 'dir',
        },
      });

      const { fetchFileContent } = await import('../client');
      await expect(
        fetchFileContent('owner', 'repo', 'src', 'token')
      ).rejects.toThrow('Path src is not a file');
    });
  });
});
