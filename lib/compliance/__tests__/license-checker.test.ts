/**
 * Unit tests for license compliance checker
 */

import { describe, it, expect, vi } from 'vitest';
import { analyzeLicenseCompliance, getLicenseStatistics } from '../license-checker';

// Mock the logger
vi.mock('@/lib/monitoring/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('analyzeLicenseCompliance', () => {
  it('should detect restrictive GPL license', () => {
    const packageLock = JSON.stringify({
      packages: {
        '': {},
        'node_modules/some-gpl-package': {
          name: 'some-gpl-package',
          version: '1.0.0',
          license: 'GPL-3.0',
        },
      },
    });

    const issues = analyzeLicenseCompliance('package-lock.json', packageLock);

    expect(issues.length).toBeGreaterThan(0);
    const gplIssue = issues.find(i => i.license.name === 'GPL 3.0');
    expect(gplIssue).toBeDefined();
    expect(gplIssue?.license.type).toBe('restrictive');
    expect(gplIssue?.severity).toBe('high');
  });

  it('should detect restrictive AGPL license', () => {
    const packageLock = JSON.stringify({
      packages: {
        '': {},
        'node_modules/some-agpl-package': {
          name: 'some-agpl-package',
          version: '1.0.0',
          license: 'AGPL-3.0',
        },
      },
    });

    const issues = analyzeLicenseCompliance('package-lock.json', packageLock);

    const agplIssue = issues.find(i => i.dependency.name === 'some-agpl-package');
    expect(agplIssue).toBeDefined();
    expect(agplIssue?.license.type).toBe('restrictive');
    expect(agplIssue?.severity).toBe('high');
    expect(agplIssue?.explanation).toContain('open-source');
  });

  it('should allow permissive MIT license', () => {
    const packageLock = JSON.stringify({
      packages: {
        '': {},
        'node_modules/some-mit-package': {
          name: 'some-mit-package',
          version: '1.0.0',
          license: 'MIT',
        },
      },
    });

    const issues = analyzeLicenseCompliance('package-lock.json', packageLock);

    // MIT is permissive, should not create issues
    const mitIssue = issues.find(i => i.dependency.name === 'some-mit-package');
    expect(mitIssue).toBeUndefined();
  });

  it('should flag unknown licenses', () => {
    const packageLock = JSON.stringify({
      packages: {
        '': {},
        'node_modules/weird-license-package': {
          name: 'weird-license-package',
          version: '1.0.0',
          license: 'Custom-Proprietary-License',
        },
      },
    });

    const issues = analyzeLicenseCompliance('package-lock.json', packageLock);

    const unknownIssue = issues.find(i => i.dependency.name === 'weird-license-package');
    expect(unknownIssue).toBeDefined();
    expect(unknownIssue?.license.type).toBe('unknown');
    expect(unknownIssue?.severity).toBe('low');
  });

  it('should flag missing licenses', () => {
    const packageLock = JSON.stringify({
      packages: {
        '': {},
        'node_modules/no-license-package': {
          name: 'no-license-package',
          version: '1.0.0',
        },
      },
    });

    const issues = analyzeLicenseCompliance('package-lock.json', packageLock);

    const missingIssue = issues.find(i => i.dependency.name === 'no-license-package');
    expect(missingIssue).toBeDefined();
    expect(missingIssue?.license.name).toBe('UNKNOWN');
    expect(missingIssue?.severity).toBe('medium');
    expect(missingIssue?.explanation).toContain('no license information');
  });

  it('should respect allowed license list', () => {
    const packageLock = JSON.stringify({
      packages: {
        '': {},
        'node_modules/apache-package': {
          name: 'apache-package',
          version: '1.0.0',
          license: 'Apache-2.0',
        },
        'node_modules/gpl-package': {
          name: 'gpl-package',
          version: '1.0.0',
          license: 'GPL-3.0',
        },
      },
    });

    const allowedLicenses = ['MIT', 'Apache-2.0', 'BSD-3-Clause'];
    const issues = analyzeLicenseCompliance('package-lock.json', packageLock, allowedLicenses);

    // Apache should be allowed
    const apacheIssue = issues.find(i => i.dependency.name === 'apache-package');
    expect(apacheIssue).toBeUndefined();

    // GPL should be flagged
    const gplIssue = issues.find(i => i.dependency.name === 'gpl-package');
    expect(gplIssue).toBeDefined();
    expect(gplIssue?.explanation).toContain('not in the allowed license list');
  });

  it('should handle package-lock.json v1 format', () => {
    const packageLock = JSON.stringify({
      dependencies: {
        'some-package': {
          version: '1.0.0',
          license: 'MIT',
        },
        'gpl-package': {
          version: '2.0.0',
          license: 'GPL-2.0',
        },
      },
    });

    const issues = analyzeLicenseCompliance('package-lock.json', packageLock);

    // Should detect GPL in v1 format
    const gplIssue = issues.find(i => i.license.name === 'GPL 2.0');
    expect(gplIssue).toBeDefined();
  });

  it('should return empty array for unsupported files', () => {
    const issues = analyzeLicenseCompliance('requirements.txt', 'django==4.0.0');
    expect(issues).toEqual([]);
  });
});

describe('getLicenseStatistics', () => {
  it('should calculate license statistics correctly', () => {
    const issues = [
      {
        dependency: { name: 'pkg1', version: '1.0.0', ecosystem: 'npm' as const },
        license: { name: 'MIT', type: 'permissive' as const },
        severity: 'low' as const,
        explanation: 'test',
      },
      {
        dependency: { name: 'pkg2', version: '1.0.0', ecosystem: 'npm' as const },
        license: { name: 'GPL-3.0', type: 'restrictive' as const },
        severity: 'high' as const,
        explanation: 'test',
      },
      {
        dependency: { name: 'pkg3', version: '1.0.0', ecosystem: 'npm' as const },
        license: { name: 'UNKNOWN', type: 'unknown' as const },
        severity: 'medium' as const,
        explanation: 'test',
      },
    ];

    const stats = getLicenseStatistics(issues);

    expect(stats.total).toBe(3);
    expect(stats.permissive).toBe(1);
    expect(stats.restrictive).toBe(1);
    expect(stats.unknown).toBe(1);
  });

  it('should handle empty issues array', () => {
    const stats = getLicenseStatistics([]);

    expect(stats.total).toBe(0);
    expect(stats.permissive).toBe(0);
    expect(stats.restrictive).toBe(0);
    expect(stats.unknown).toBe(0);
  });
});
