/**
 * Tech Stack Detection Tests
 * 
 * Tests for technology stack auto-detection
 */

import { describe, it, expect, vi } from 'vitest';
import { detectTechStack } from '../tech-stack';

// Mock the GitHub client
vi.mock('../client', () => ({
  fetchFileContent: vi.fn(),
}));

describe('Tech Stack Detection', () => {
  describe('detectTechStack', () => {
    it('should detect Node.js/Next.js stack from package.json', async () => {
      const { fetchFileContent } = await import('../client');
      
      (fetchFileContent as any).mockResolvedValue(JSON.stringify({
        name: 'my-app',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
      }));

      const result = await detectTechStack(
        'owner',
        'repo',
        ['package.json', 'src/index.ts'],
        'token'
      );

      expect(result).not.toBeNull();
      expect(result?.framework).toBe('Next.js');
      expect(result?.language).toBe('TypeScript');
      expect(result?.dependencies).toContain('next');
      expect(result?.dependencies).toContain('react');
    });

    it('should detect Python/Django stack from requirements.txt', async () => {
      const { fetchFileContent } = await import('../client');
      
      (fetchFileContent as any).mockResolvedValue(
        'django==4.2.0\npsycopg2==2.9.0\ncelery==5.3.0'
      );

      const result = await detectTechStack(
        'owner',
        'repo',
        ['requirements.txt', 'manage.py'],
        'token'
      );

      expect(result).not.toBeNull();
      expect(result?.framework).toBe('Django');
      expect(result?.language).toBe('Python');
      expect(result?.dependencies).toContain('django');
      expect(result?.dependencies).toContain('psycopg2');
    });

    it('should detect Go/Gin stack from go.mod', async () => {
      const { fetchFileContent } = await import('../client');
      
      (fetchFileContent as any).mockResolvedValue(`
module github.com/owner/repo

go 1.21

require (
  github.com/gin-gonic/gin v1.9.0
  github.com/lib/pq v1.10.0
)
      `);

      const result = await detectTechStack(
        'owner',
        'repo',
        ['go.mod', 'main.go'],
        'token'
      );

      expect(result).not.toBeNull();
      expect(result?.framework).toBe('Gin');
      expect(result?.language).toBe('Go');
      expect(result?.dependencies.some(dep => dep.includes('gin-gonic/gin'))).toBe(true);
    });

    it('should detect Ruby on Rails stack from Gemfile', async () => {
      const { fetchFileContent } = await import('../client');
      
      (fetchFileContent as any).mockResolvedValue(`
source 'https://rubygems.org'

gem 'rails', '~> 7.0.0'
gem 'pg', '~> 1.1'
gem 'puma', '~> 5.0'
      `);

      const result = await detectTechStack(
        'owner',
        'repo',
        ['Gemfile', 'config.ru'],
        'token'
      );

      expect(result).not.toBeNull();
      expect(result?.framework).toBe('Ruby on Rails');
      expect(result?.language).toBe('Ruby');
      expect(result?.dependencies).toContain('rails');
    });

    it('should return null for unknown tech stack', async () => {
      const result = await detectTechStack(
        'owner',
        'repo',
        ['README.md', 'LICENSE'],
        'token'
      );

      expect(result).toBeNull();
    });

    it('should handle errors gracefully and return default stack', async () => {
      const { fetchFileContent } = await import('../client');
      
      (fetchFileContent as any).mockRejectedValue(new Error('GitHub API error'));

      const result = await detectTechStack(
        'owner',
        'repo',
        ['package.json'],
        'token'
      );

      expect(result).not.toBeNull();
      expect(result?.framework).toBe('Node.js');
      expect(result?.language).toBe('JavaScript');
      expect(result?.dependencies).toEqual([]);
    });
  });
});
