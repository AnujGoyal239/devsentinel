/**
 * GitHub REST API Client
 * 
 * Provides functions to interact with GitHub API:
 * - Fetch repository file tree
 * - Fetch individual file contents
 * - Exponential backoff retry logic for rate limits
 * - Redis caching (5 minutes TTL)
 */

import { Octokit } from '@octokit/rest';
import { redis } from '@/lib/redis/client';

const CACHE_TTL = 300; // 5 minutes in seconds
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second

/**
 * File tree node from GitHub API
 */
export interface GitHubTreeNode {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

/**
 * File tree response
 */
export interface FileTree {
  files: GitHubTreeNode[];
  total: number;
}

/**
 * File content response
 */
export interface FileContent {
  content: string;
  encoding: string;
  size: number;
  sha: string;
  path: string;
}

/**
 * GitHub API Error Types
 */
export class GitHubApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public isRateLimit: boolean = false
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

/**
 * Exponential backoff retry wrapper
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  backoff = INITIAL_BACKOFF
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Check if it's a rate limit error (403 or 429)
    const isRateLimit = 
      error?.status === 403 || 
      error?.status === 429 ||
      error?.response?.status === 403 ||
      error?.response?.status === 429;

    if (isRateLimit && retries > 0) {
      console.log(`[GitHub] Rate limit hit, retrying in ${backoff}ms (${retries} retries left)`);
      
      // Wait with exponential backoff
      await new Promise(resolve => setTimeout(resolve, backoff));
      
      // Retry with doubled backoff
      return withRetry(fn, retries - 1, backoff * 2);
    }

    // Transform error into GitHubApiError
    const statusCode = error?.status || error?.response?.status || 500;
    const message = error?.message || 'GitHub API request failed';
    
    throw new GitHubApiError(message, statusCode, isRateLimit);
  }
}

/**
 * Fetch complete file tree from GitHub repository
 * 
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name (default: 'main')
 * @param token - GitHub OAuth token
 * @returns File tree with all files
 * @throws GitHubApiError if fetch fails after retries
 */
export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<FileTree> {
  const cacheKey = `github:tree:${owner}:${repo}:${branch}`;

  // Check cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('[GitHub] Redis cache read error:', error);
    // Continue without cache
  }

  // Fetch from GitHub with retry logic
  try {
    const result = await withRetry(async () => {
      const octokit = new Octokit({ auth: token });

      const response = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: branch,
        recursive: 'true',
      });

      // Filter only files (blobs), exclude directories (trees)
      const files = response.data.tree.filter(
        (node): node is GitHubTreeNode => node.type === 'blob'
      );

      return {
        files,
        total: files.length,
      };
    });

    // Cache the result
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch (error) {
      console.error('[GitHub] Redis cache write error:', error);
      // Continue without caching
    }

    return result;
  } catch (error) {
    if (error instanceof GitHubApiError) {
      if (error.isRateLimit) {
        throw new GitHubApiError(
          'GitHub API rate limit exceeded. Please try again later.',
          429,
          true
        );
      }
      if (error.statusCode === 401) {
        throw new GitHubApiError(
          'GitHub authentication failed. Please reconnect your GitHub account.',
          401
        );
      }
      if (error.statusCode === 404) {
        throw new GitHubApiError(
          `Repository ${owner}/${repo} not found or you don't have access.`,
          404
        );
      }
      throw error;
    }
    throw new GitHubApiError(
      'Failed to fetch repository file tree from GitHub.',
      500
    );
  }
}

/**
 * Fetch individual file content from GitHub repository
 * 
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path
 * @param token - GitHub OAuth token
 * @returns Decoded file content
 * @throws GitHubApiError if fetch fails after retries
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token: string
): Promise<string> {
  const cacheKey = `github:file:${owner}:${repo}:${path}`;

  // Check cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.error('[GitHub] Redis cache read error:', error);
    // Continue without cache
  }

  // Fetch from GitHub with retry logic
  try {
    const content = await withRetry(async () => {
      const octokit = new Octokit({ auth: token });

      const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      // Handle file content (not directory)
      if ('content' in response.data && response.data.type === 'file') {
        // Decode base64 content
        const decoded = Buffer.from(response.data.content, 'base64').toString('utf-8');
        return decoded;
      }

      throw new Error(`Path ${path} is not a file`);
    });

    // Cache the result
    try {
      await redis.setex(cacheKey, CACHE_TTL, content);
    } catch (error) {
      console.error('[GitHub] Redis cache write error:', error);
      // Continue without caching
    }

    return content;
  } catch (error) {
    if (error instanceof GitHubApiError) {
      if (error.isRateLimit) {
        throw new GitHubApiError(
          'GitHub API rate limit exceeded. Please try again later.',
          429,
          true
        );
      }
      if (error.statusCode === 401) {
        throw new GitHubApiError(
          'GitHub authentication failed. Please reconnect your GitHub account.',
          401
        );
      }
      if (error.statusCode === 404) {
        throw new GitHubApiError(
          `File ${path} not found in repository ${owner}/${repo}.`,
          404
        );
      }
      throw error;
    }
    throw new GitHubApiError(
      `Failed to fetch file content from GitHub: ${path}`,
      500
    );
  }
}

/**
 * Get GitHub API rate limit status
 * 
 * @param token - GitHub OAuth token
 * @returns Rate limit information
 */
export async function getRateLimit(token: string) {
  const octokit = new Octokit({ auth: token });
  const response = await octokit.rateLimit.get();
  
  return {
    limit: response.data.rate.limit,
    remaining: response.data.rate.remaining,
    reset: new Date(response.data.rate.reset * 1000),
  };
}
