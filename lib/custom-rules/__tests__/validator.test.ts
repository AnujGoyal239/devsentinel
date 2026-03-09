/**
 * Custom Rules Validator Tests
 */

import { describe, it, expect } from 'vitest';
import { validateCustomRuleYAML, validateCustomRule } from '../validator';

describe('validateCustomRuleYAML', () => {
  it('should validate a valid YAML rule', () => {
    const yaml = `
name: No console.log
severity: medium
file_pattern: .*\\.ts$
content_pattern: console\\.log
message: Remove console.log statements before production
`;

    const result = validateCustomRuleYAML(yaml);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.rule).toBeDefined();
    expect(result.rule?.name).toBe('No console.log');
    expect(result.rule?.severity).toBe('medium');
  });

  it('should validate a YAML rule with optional fields', () => {
    const yaml = `
name: Check TODO comments
description: Ensure all TODOs are tracked
enabled: false
severity: low
file_pattern: .*\\.ts$
content_pattern: "TODO:"
message: Found untracked TODO comment
`;

    const result = validateCustomRuleYAML(yaml);
    expect(result.valid).toBe(true);
    expect(result.rule?.description).toBe('Ensure all TODOs are tracked');
    expect(result.rule?.enabled).toBe(false);
  });

  it('should reject invalid YAML syntax', () => {
    const yaml = `
name: Invalid YAML
severity: medium
  - invalid
    - nested
      - structure
`;

    const result = validateCustomRuleYAML(yaml);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // YAML parser is forgiving, so we just check that validation fails
  });

  it('should reject missing required fields', () => {
    const yaml = `
name: Missing Fields
`;

    const result = validateCustomRuleYAML(yaml);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Field "severity" is required and must be a string');
    expect(result.errors).toContain('Field "file_pattern" is required and must be a string');
    expect(result.errors).toContain('Field "message" is required and must be a string');
  });

  it('should reject invalid severity values', () => {
    const yaml = `
name: Invalid Severity
severity: super-critical
file_pattern: .*\\.ts$
message: Test message
`;

    const result = validateCustomRuleYAML(yaml);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Field "severity" must be one of: critical, high, medium, low, info');
  });

  it('should reject invalid regex patterns', () => {
    const yaml = `
name: Invalid Regex
severity: medium
file_pattern: "[invalid"
message: Test message
`;

    const result = validateCustomRuleYAML(yaml);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('valid regex pattern'))).toBe(true);
  });

  it('should reject invalid content_pattern regex', () => {
    const yaml = `
name: Invalid Content Pattern
severity: medium
file_pattern: .*\\.ts$
content_pattern: "[invalid"
message: Test message
`;

    const result = validateCustomRuleYAML(yaml);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('content_pattern') && e.includes('valid regex pattern'))).toBe(true);
  });
});

describe('validateCustomRule', () => {
  it('should validate a valid rule object', () => {
    const rule = {
      name: 'No console.log',
      severity: 'medium' as const,
      file_pattern: '.*\\.ts$',
      content_pattern: 'console\\.log',
      message: 'Remove console.log statements',
    };

    const result = validateCustomRule(rule);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate a rule without content_pattern', () => {
    const rule = {
      name: 'TypeScript files only',
      severity: 'info' as const,
      file_pattern: '.*\\.js$',
      message: 'Use TypeScript instead of JavaScript',
    };

    const result = validateCustomRule(rule);
    expect(result.valid).toBe(true);
  });

  it('should reject missing required fields', () => {
    const rule = {
      name: 'Incomplete Rule',
    };

    const result = validateCustomRule(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject invalid field types', () => {
    const rule = {
      name: 123,
      severity: 'medium',
      file_pattern: '.*\\.ts$',
      message: 'Test',
    };

    const result = validateCustomRule(rule as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Field "name" is required and must be a string');
  });
});
