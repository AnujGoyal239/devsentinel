/**
 * Custom Rules Engine Tests
 */

import { describe, it, expect } from 'vitest';
import { executeCustomRules, convertMatchesToFindings } from '../engine';
import type { CustomRule } from '../types';

describe('executeCustomRules', () => {
  const mockRule: CustomRule = {
    id: 'rule-1',
    project_id: 'project-1',
    name: 'No console.log',
    description: 'Remove console.log statements',
    enabled: true,
    severity: 'medium',
    file_pattern: '.*\\.ts$',
    content_pattern: 'console\\.log',
    message: 'Found console.log statement',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('should match files by file pattern only', async () => {
    const rule: CustomRule = {
      ...mockRule,
      content_pattern: null,
      file_pattern: '.*\\.test\\.ts$',
    };

    const matches = await executeCustomRules(
      [rule],
      'src/utils.test.ts',
      'const x = 1;'
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].file_path).toBe('src/utils.test.ts');
    expect(matches[0].line_start).toBeNull();
    expect(matches[0].line_end).toBeNull();
  });

  it('should not match files that do not match file pattern', async () => {
    const rule: CustomRule = {
      ...mockRule,
      file_pattern: '.*\\.ts$',
    };

    const matches = await executeCustomRules(
      [rule],
      'src/utils.js',
      'console.log("test");'
    );

    expect(matches).toHaveLength(0);
  });

  it('should match content pattern and return line numbers', async () => {
    const fileContent = `
function test() {
  console.log("debug");
  return true;
}
`.trim();

    const matches = await executeCustomRules(
      [mockRule],
      'src/utils.ts',
      fileContent
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].line_start).toBe(2);
    expect(matches[0].line_end).toBe(2);
    expect(matches[0].matched_content).toContain('console.log');
  });

  it('should find multiple matches in the same file', async () => {
    const fileContent = `
console.log("first");
const x = 1;
console.log("second");
`.trim();

    const matches = await executeCustomRules(
      [mockRule],
      'src/utils.ts',
      fileContent
    );

    expect(matches).toHaveLength(2);
    expect(matches[0].line_start).toBe(1);
    expect(matches[1].line_start).toBe(3);
  });

  it('should skip disabled rules', async () => {
    const disabledRule: CustomRule = {
      ...mockRule,
      enabled: false,
    };

    const matches = await executeCustomRules(
      [disabledRule],
      'src/utils.ts',
      'console.log("test");'
    );

    expect(matches).toHaveLength(0);
  });

  it('should handle multiple rules', async () => {
    const rule2: CustomRule = {
      ...mockRule,
      id: 'rule-2',
      name: 'No TODO comments',
      content_pattern: 'TODO:',
      message: 'Found TODO comment',
    };

    const fileContent = `
console.log("test");
// TODO: fix this
`.trim();

    const matches = await executeCustomRules(
      [mockRule, rule2],
      'src/utils.ts',
      fileContent
    );

    expect(matches).toHaveLength(2);
    expect(matches[0].rule.name).toBe('No console.log');
    expect(matches[1].rule.name).toBe('No TODO comments');
  });

  it('should handle regex special characters in patterns', async () => {
    const rule: CustomRule = {
      ...mockRule,
      content_pattern: 'process\\.env\\.NODE_ENV',
    };

    const fileContent = 'if (process.env.NODE_ENV === "production") {}';

    const matches = await executeCustomRules(
      [rule],
      'src/config.ts',
      fileContent
    );

    expect(matches).toHaveLength(1);
  });

  it('should handle invalid regex gracefully', async () => {
    const rule: CustomRule = {
      ...mockRule,
      content_pattern: '[invalid',
    };

    const matches = await executeCustomRules(
      [rule],
      'src/utils.ts',
      'console.log("test");'
    );

    // Should not throw, just return empty matches
    expect(matches).toHaveLength(0);
  });
});

describe('convertMatchesToFindings', () => {
  const mockRule: CustomRule = {
    id: 'rule-1',
    project_id: 'project-1',
    name: 'No console.log',
    description: 'Remove console.log statements',
    enabled: true,
    severity: 'medium',
    file_pattern: '.*\\.ts$',
    content_pattern: 'console\\.log',
    message: 'Found console.log statement',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('should convert matches to findings', () => {
    const matches = [
      {
        rule: mockRule,
        file_path: 'src/utils.ts',
        line_start: 10,
        line_end: 10,
        matched_content: 'console.log("test");',
      },
    ];

    const findings = convertMatchesToFindings(matches, 'run-1', 'project-1');

    expect(findings).toHaveLength(1);
    expect(findings[0].run_id).toBe('run-1');
    expect(findings[0].category).toBe('custom');
    expect(findings[0].severity).toBe('medium');
    expect(findings[0].bug_type).toBe('No console.log');
    expect(findings[0].status).toBe('fail');
    expect(findings[0].file_path).toBe('src/utils.ts');
    expect(findings[0].line_start).toBe(10);
    expect(findings[0].line_end).toBe(10);
    expect(findings[0].code_snippet).toBe('console.log("test");');
    expect(findings[0].explanation).toBe('Found console.log statement');
    expect(findings[0].pass_number).toBe(2);
  });

  it('should handle matches without line numbers', () => {
    const matches = [
      {
        rule: mockRule,
        file_path: 'src/utils.ts',
        line_start: null,
        line_end: null,
        matched_content: null,
      },
    ];

    const findings = convertMatchesToFindings(matches, 'run-1', 'project-1');

    expect(findings).toHaveLength(1);
    expect(findings[0].line_start).toBeNull();
    expect(findings[0].line_end).toBeNull();
    expect(findings[0].code_snippet).toBeNull();
  });

  it('should preserve severity from rule', () => {
    const criticalRule: CustomRule = {
      ...mockRule,
      severity: 'critical',
    };

    const matches = [
      {
        rule: criticalRule,
        file_path: 'src/utils.ts',
        line_start: 1,
        line_end: 1,
        matched_content: 'test',
      },
    ];

    const findings = convertMatchesToFindings(matches, 'run-1', 'project-1');

    expect(findings[0].severity).toBe('critical');
  });
});
