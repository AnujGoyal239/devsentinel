/**
 * Custom Rules Validator
 * 
 * Validates YAML syntax and rule structure
 */

import yaml from 'yaml';
import { CustomRuleYAML } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  rule?: CustomRuleYAML;
}

/**
 * Validate YAML syntax and rule structure
 */
export function validateCustomRuleYAML(yamlContent: string): ValidationResult {
  const errors: string[] = [];

  // Parse YAML
  let parsed: any;
  try {
    parsed = yaml.parse(yamlContent);
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid YAML syntax: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }

  // Validate required fields
  if (!parsed.name || typeof parsed.name !== 'string') {
    errors.push('Field "name" is required and must be a string');
  }

  if (!parsed.severity || typeof parsed.severity !== 'string') {
    errors.push('Field "severity" is required and must be a string');
  } else if (!['critical', 'high', 'medium', 'low', 'info'].includes(parsed.severity)) {
    errors.push('Field "severity" must be one of: critical, high, medium, low, info');
  }

  if (!parsed.file_pattern || typeof parsed.file_pattern !== 'string') {
    errors.push('Field "file_pattern" is required and must be a string');
  } else {
    // Validate regex pattern
    try {
      new RegExp(parsed.file_pattern);
    } catch (error) {
      errors.push(`Field "file_pattern" must be a valid regex pattern: ${error instanceof Error ? error.message : 'Invalid regex'}`);
    }
  }

  if (!parsed.message || typeof parsed.message !== 'string') {
    errors.push('Field "message" is required and must be a string');
  }

  // Validate optional fields
  if (parsed.description !== undefined && typeof parsed.description !== 'string') {
    errors.push('Field "description" must be a string');
  }

  if (parsed.enabled !== undefined && typeof parsed.enabled !== 'boolean') {
    errors.push('Field "enabled" must be a boolean');
  }

  if (parsed.content_pattern !== undefined) {
    if (typeof parsed.content_pattern !== 'string') {
      errors.push('Field "content_pattern" must be a string');
    } else {
      // Validate regex pattern
      try {
        new RegExp(parsed.content_pattern);
      } catch (error) {
        errors.push(`Field "content_pattern" must be a valid regex pattern: ${error instanceof Error ? error.message : 'Invalid regex'}`);
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
    errors: [],
    rule: {
      name: parsed.name,
      description: parsed.description,
      enabled: parsed.enabled !== undefined ? parsed.enabled : true,
      severity: parsed.severity,
      file_pattern: parsed.file_pattern,
      content_pattern: parsed.content_pattern,
      message: parsed.message,
    },
  };
}

/**
 * Validate a custom rule object (for API validation)
 */
export function validateCustomRule(rule: Partial<CustomRuleYAML>): ValidationResult {
  const errors: string[] = [];

  if (!rule.name || typeof rule.name !== 'string') {
    errors.push('Field "name" is required and must be a string');
  }

  if (!rule.severity || typeof rule.severity !== 'string') {
    errors.push('Field "severity" is required and must be a string');
  } else if (!['critical', 'high', 'medium', 'low', 'info'].includes(rule.severity)) {
    errors.push('Field "severity" must be one of: critical, high, medium, low, info');
  }

  if (!rule.file_pattern || typeof rule.file_pattern !== 'string') {
    errors.push('Field "file_pattern" is required and must be a string');
  } else {
    try {
      new RegExp(rule.file_pattern);
    } catch (error) {
      errors.push(`Field "file_pattern" must be a valid regex pattern: ${error instanceof Error ? error.message : 'Invalid regex'}`);
    }
  }

  if (!rule.message || typeof rule.message !== 'string') {
    errors.push('Field "message" is required and must be a string');
  }

  if (rule.description !== undefined && typeof rule.description !== 'string') {
    errors.push('Field "description" must be a string');
  }

  if (rule.enabled !== undefined && typeof rule.enabled !== 'boolean') {
    errors.push('Field "enabled" must be a boolean');
  }

  if (rule.content_pattern !== undefined) {
    if (typeof rule.content_pattern !== 'string') {
      errors.push('Field "content_pattern" must be a string');
    } else {
      try {
        new RegExp(rule.content_pattern);
      } catch (error) {
        errors.push(`Field "content_pattern" must be a valid regex pattern: ${error instanceof Error ? error.message : 'Invalid regex'}`);
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
    errors: [],
    rule: rule as CustomRuleYAML,
  };
}
