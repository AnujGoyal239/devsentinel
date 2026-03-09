/**
 * Vector Search Module Tests
 * 
 * Tests for vector search functionality
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock the env module before importing anything else
vi.mock('@/lib/config/env', () => ({
  env: {
    JINA_API_KEY: 'test-jina-key',
    QDRANT_URL: 'http://localhost:6333',
    QDRANT_API_KEY: 'test-qdrant-key',
  },
}));

import { filterFilesForEmbedding } from '../index';

describe('Vector Search Module', () => {
  describe('filterFilesForEmbedding', () => {
    it('should filter out binary files', () => {
      const files = [
        { path: 'src/index.ts', size: 1000 },
        { path: 'assets/logo.png', size: 5000 },
        { path: 'fonts/roboto.woff2', size: 3000 },
        { path: 'lib/utils.js', size: 2000 },
      ];

      const result = filterFilesForEmbedding(files);

      expect(result).toHaveLength(2);
      expect(result.map(f => f.path)).toEqual([
        'src/index.ts',
        'lib/utils.js',
      ]);
    });

    it('should filter out large files (>100KB)', () => {
      const files = [
        { path: 'src/small.ts', size: 50000 },
        { path: 'src/large.ts', size: 150000 },
        { path: 'src/medium.ts', size: 80000 },
      ];

      const result = filterFilesForEmbedding(files);

      expect(result).toHaveLength(2);
      expect(result.map(f => f.path)).toEqual([
        'src/small.ts',
        'src/medium.ts',
      ]);
    });

    it('should filter out node_modules and build directories', () => {
      const files = [
        { path: 'src/index.ts', size: 1000 },
        { path: 'node_modules/package/index.js', size: 2000 },
        { path: 'dist/bundle.js', size: 3000 },
        { path: 'build/output.js', size: 4000 },
        { path: 'lib/utils.ts', size: 1500 },
      ];

      const result = filterFilesForEmbedding(files);

      expect(result).toHaveLength(2);
      expect(result.map(f => f.path)).toEqual([
        'src/index.ts',
        'lib/utils.ts',
      ]);
    });

    it('should filter out lock files and minified files', () => {
      const files = [
        { path: 'src/index.ts', size: 1000 },
        { path: 'package-lock.json', size: 50000 },
        { path: 'yarn.lock', size: 40000 },
        { path: 'dist/bundle.min.js', size: 30000 },
        { path: 'lib/utils.ts', size: 1500 },
      ];

      const result = filterFilesForEmbedding(files);

      expect(result.map(f => f.path)).toEqual([
        'src/index.ts',
        'lib/utils.ts',
      ]);
    });

    it('should handle files without size property', () => {
      const files = [
        { path: 'src/index.ts' },
        { path: 'assets/logo.png' },
        { path: 'lib/utils.js' },
      ];

      const result = filterFilesForEmbedding(files);

      // Should filter out binary files but keep source files
      expect(result).toHaveLength(2);
      expect(result.map(f => f.path)).toEqual([
        'src/index.ts',
        'lib/utils.js',
      ]);
    });

    it('should handle empty array', () => {
      const files: Array<{ path: string; size?: number }> = [];
      const result = filterFilesForEmbedding(files);
      expect(result).toHaveLength(0);
    });

    it('should include common source code file types', () => {
      const files = [
        { path: 'src/index.ts', size: 1000 },
        { path: 'src/utils.js', size: 1000 },
        { path: 'lib/helper.py', size: 1000 },
        { path: 'cmd/main.go', size: 1000 },
        { path: 'app/controller.rb', size: 1000 },
        { path: 'src/Component.tsx', size: 1000 },
        { path: 'styles/main.css', size: 1000 },
        { path: 'README.md', size: 1000 },
      ];

      const result = filterFilesForEmbedding(files);

      expect(result).toHaveLength(8);
    });
  });
});
