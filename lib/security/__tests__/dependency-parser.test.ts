/**
 * Unit tests for dependency parser
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parsePackageJson,
  parseRequirementsTxt,
  parseGoMod,
  parseGemfileLock,
  parseDependencies,
} from '../dependency-parser';

// Mock the logger
vi.mock('@/lib/monitoring/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('parsePackageJson', () => {
  it('should parse production dependencies', () => {
    const content = JSON.stringify({
      dependencies: {
        'react': '^18.2.0',
        'next': '14.0.0',
      },
    });

    const result = parsePackageJson(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'react',
      version: '18.2.0',
      ecosystem: 'npm',
      isDev: false,
    });
    expect(result[1]).toEqual({
      name: 'next',
      version: '14.0.0',
      ecosystem: 'npm',
      isDev: false,
    });
  });

  it('should parse dev dependencies', () => {
    const content = JSON.stringify({
      devDependencies: {
        'typescript': '~5.0.0',
        'vitest': '^1.0.0',
      },
    });

    const result = parsePackageJson(content);

    expect(result).toHaveLength(2);
    expect(result[0].isDev).toBe(true);
    expect(result[1].isDev).toBe(true);
  });

  it('should handle invalid JSON', () => {
    const result = parsePackageJson('invalid json');
    expect(result).toEqual([]);
  });
});

describe('parseRequirementsTxt', () => {
  it('should parse exact version requirements', () => {
    const content = `
django==4.2.0
requests==2.28.0
# This is a comment
pytest==7.3.0
`;

    const result = parseRequirementsTxt(content);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      name: 'django',
      version: '4.2.0',
      ecosystem: 'PyPI',
      isDev: false,
    });
  });

  it('should parse minimum version requirements', () => {
    const content = 'flask>=2.0.0';

    const result = parseRequirementsTxt(content);

    expect(result).toHaveLength(1);
    expect(result[0].version).toBe('2.0.0');
  });

  it('should skip comments and empty lines', () => {
    const content = `
# Comment
django==4.2.0

requests==2.28.0
`;

    const result = parseRequirementsTxt(content);
    expect(result).toHaveLength(2);
  });
});

describe('parseGoMod', () => {
  it('should parse require block', () => {
    const content = `
module example.com/myapp

go 1.20

require (
  github.com/gin-gonic/gin v1.9.0
  github.com/lib/pq v1.10.7
)
`;

    const result = parseGoMod(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'github.com/gin-gonic/gin',
      version: '1.9.0',
      ecosystem: 'Go',
      isDev: false,
    });
  });

  it('should parse single require statements', () => {
    const content = 'require github.com/gin-gonic/gin v1.9.0';

    const result = parseGoMod(content);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('github.com/gin-gonic/gin');
  });
});

describe('parseGemfileLock', () => {
  it('should parse GEM section', () => {
    const content = `
GEM
  remote: https://rubygems.org/
  specs:
    rails (7.0.4)
    puma (5.6.5)
`;

    const result = parseGemfileLock(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'rails',
      version: '7.0.4',
      ecosystem: 'RubyGems',
      isDev: false,
    });
  });
});

describe('parseDependencies', () => {
  it('should route to correct parser based on filename', () => {
    const packageJson = JSON.stringify({ dependencies: { 'react': '18.0.0' } });
    const result1 = parseDependencies('package.json', packageJson);
    expect(result1[0].ecosystem).toBe('npm');

    const requirementsTxt = 'django==4.2.0';
    const result2 = parseDependencies('requirements.txt', requirementsTxt);
    expect(result2[0].ecosystem).toBe('PyPI');

    const goMod = 'require github.com/gin-gonic/gin v1.9.0';
    const result3 = parseDependencies('go.mod', goMod);
    expect(result3[0].ecosystem).toBe('Go');

    const gemfileLock = 'GEM\n  specs:\n    rails (7.0.4)';
    const result4 = parseDependencies('Gemfile.lock', gemfileLock);
    expect(result4[0].ecosystem).toBe('RubyGems');
  });

  it('should return empty array for unknown file types', () => {
    const result = parseDependencies('unknown.txt', 'content');
    expect(result).toEqual([]);
  });
});
