/**
 * Custom Rules Engine
 * 
 * Executes custom rules against files during analysis
 */

import { CustomRule, CustomRuleMatch } from './types';

/**
 * Execute custom rules against a file
 */
export async function executeCustomRules(
  rules: CustomRule[],
  filePath: string,
  fileContent: string
): Promise<CustomRuleMatch[]> {
  const matches: CustomRuleMatch[] = [];

  // Filter enabled rules
  const enabledRules = rules.filter(rule => rule.enabled);

  for (const rule of enabledRules) {
    try {
      // Check if file path matches the pattern
      const filePatternRegex = new RegExp(rule.file_pattern);
      if (!filePatternRegex.test(filePath)) {
        continue; // Skip this rule if file path doesn't match
      }

      // If no content pattern, just match on file path
      if (!rule.content_pattern) {
        matches.push({
          rule,
          file_path: filePath,
          line_start: null,
          line_end: null,
          matched_content: null,
        });
        continue;
      }

      // Check content pattern
      const contentPatternRegex = new RegExp(rule.content_pattern, 'gm');
      const lines = fileContent.split('\n');
      
      let match;
      while ((match = contentPatternRegex.exec(fileContent)) !== null) {
        // Find line number of match
        const matchIndex = match.index;
        let lineNumber = 1;
        let currentIndex = 0;

        for (let i = 0; i < lines.length; i++) {
          currentIndex += lines[i].length + 1; // +1 for newline
          if (currentIndex > matchIndex) {
            lineNumber = i + 1;
            break;
          }
        }

        // Extract matched content (up to 3 lines of context)
        const startLine = Math.max(0, lineNumber - 2);
        const endLine = Math.min(lines.length, lineNumber + 1);
        const matchedContent = lines.slice(startLine, endLine).join('\n');

        matches.push({
          rule,
          file_path: filePath,
          line_start: lineNumber,
          line_end: lineNumber,
          matched_content: matchedContent,
        });
      }
    } catch (error) {
      console.error(`Error executing custom rule "${rule.name}":`, error);
      // Continue with other rules even if one fails
    }
  }

  return matches;
}

/**
 * Convert custom rule matches to findings
 */
export function convertMatchesToFindings(
  matches: CustomRuleMatch[],
  runId: string,
  projectId: string
) {
  return matches.map(match => ({
    run_id: runId,
    requirement_id: null,
    pass_number: 2 as const,
    category: 'custom' as const,
    severity: match.rule.severity,
    bug_type: match.rule.name,
    status: 'fail' as const,
    file_path: match.file_path,
    line_start: match.line_start,
    line_end: match.line_end,
    code_snippet: match.matched_content,
    explanation: match.rule.message,
    fix_confidence: null,
    fix_original: null,
    fix_suggested: null,
    fix_explanation: null,
  }));
}
