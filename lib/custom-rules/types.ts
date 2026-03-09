/**
 * Custom Rules Types
 * 
 * Type definitions for custom analysis rules
 */

export interface CustomRule {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  file_pattern: string; // Regex pattern for file paths
  content_pattern: string | null; // Regex pattern for file content
  message: string;
  created_at: string;
  updated_at: string;
}

export interface CustomRuleYAML {
  name: string;
  description?: string;
  enabled?: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  file_pattern: string;
  content_pattern?: string;
  message: string;
}

export interface CustomRuleMatch {
  rule: CustomRule;
  file_path: string;
  line_start: number | null;
  line_end: number | null;
  matched_content: string | null;
}
