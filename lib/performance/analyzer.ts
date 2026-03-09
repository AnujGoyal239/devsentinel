/**
 * Performance Anti-Pattern Analyzer
 * 
 * Detects common performance issues in code:
 * - N+1 query patterns
 * - Synchronous operations in async contexts
 * - Inefficient loops and nested iterations
 * - Missing pagination on large data queries
 * - Missing database indexes
 */

import { logger } from '@/lib/monitoring/logger';
import type { Finding, FindingSeverity } from '@/lib/supabase/types';

export interface PerformanceIssue {
  type: 'n_plus_one' | 'sync_in_async' | 'inefficient_loop' | 'missing_pagination' | 'missing_index';
  severity: FindingSeverity;
  file_path: string;
  line_start: number;
  line_end: number;
  code_snippet: string;
  explanation: string;
  fix_original: string;
  fix_suggested: string;
  fix_explanation: string;
  impact: 'high' | 'medium' | 'low';
}

/**
 * Analyze code for N+1 query patterns
 */
export function detectNPlusOneQueries(filePath: string, content: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const lines = content.split('\n');

  // Pattern: Loop with database query inside
  const loopPatterns = [
    /for\s*\(/,
    /forEach\s*\(/,
    /\.map\s*\(/,
    /while\s*\(/,
  ];

  const queryPatterns = [
    /\.find\s*\(/,
    /\.findOne\s*\(/,
    /\.findById\s*\(/,
    /\.query\s*\(/,
    /\.execute\s*\(/,
    /SELECT\s+.*\s+FROM/i,
    /await\s+.*\.find/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line contains a loop
    const hasLoop = loopPatterns.some(pattern => pattern.test(line));
    
    if (hasLoop) {
      // Check next 10 lines for database queries
      const endLine = Math.min(i + 10, lines.length);
      for (let j = i + 1; j < endLine; j++) {
        const innerLine = lines[j];
        const hasQuery = queryPatterns.some(pattern => pattern.test(innerLine));
        
        if (hasQuery) {
          const codeSnippet = lines.slice(i, j + 1).join('\n');
          
          issues.push({
            type: 'n_plus_one',
            severity: 'high',
            file_path: filePath,
            line_start: i + 1,
            line_end: j + 1,
            code_snippet: codeSnippet,
            explanation: 'N+1 query detected: Database query inside a loop. This will execute one query per iteration, causing severe performance degradation with large datasets.',
            fix_original: codeSnippet,
            fix_suggested: '// Use a single query with WHERE IN clause or JOIN\n// Example: const items = await Model.find({ id: { $in: ids } });',
            fix_explanation: 'Replace the loop with a single bulk query using WHERE IN or JOIN to fetch all required data at once.',
            impact: 'high',
          });
          
          break; // Only report once per loop
        }
      }
    }
  }

  return issues;
}

/**
 * Detect synchronous operations in async contexts
 */
export function detectSyncInAsync(filePath: string, content: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const lines = content.split('\n');

  const syncPatterns = [
    { pattern: /fs\.readFileSync\s*\(/, name: 'fs.readFileSync', async: 'fs.promises.readFile' },
    { pattern: /fs\.writeFileSync\s*\(/, name: 'fs.writeFileSync', async: 'fs.promises.writeFile' },
    { pattern: /fs\.existsSync\s*\(/, name: 'fs.existsSync', async: 'fs.promises.access' },
    { pattern: /JSON\.parse\s*\(.*\)(?!.*catch)/, name: 'JSON.parse without try-catch', async: 'JSON.parse with try-catch' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if we're in an async function (look back up to 5 lines)
    const startLine = Math.max(0, i - 5);
    const contextLines = lines.slice(startLine, i + 1).join('\n');
    const isAsync = /async\s+(function|=>|\()/i.test(contextLines);
    
    if (isAsync) {
      for (const { pattern, name, async } of syncPatterns) {
        if (pattern.test(line)) {
          issues.push({
            type: 'sync_in_async',
            severity: 'medium',
            file_path: filePath,
            line_start: i + 1,
            line_end: i + 1,
            code_snippet: line.trim(),
            explanation: `Synchronous operation '${name}' used in async function. This blocks the event loop and degrades performance.`,
            fix_original: line.trim(),
            fix_suggested: `// Use async alternative: ${async}`,
            fix_explanation: `Replace ${name} with its async alternative ${async} and use await.`,
            impact: 'medium',
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Detect inefficient loops and nested iterations
 */
export function detectInefficientLoops(filePath: string, content: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const lines = content.split('\n');

  let loopDepth = 0;
  let loopStack: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect loop start
    if (/for\s*\(|forEach\s*\(|\.map\s*\(|while\s*\(/.test(line)) {
      loopStack.push(i);
      loopDepth++;
      
      // Nested loop detected (depth >= 3 is problematic)
      if (loopDepth >= 3) {
        const startLine = loopStack[0];
        const codeSnippet = lines.slice(startLine, i + 1).join('\n');
        
        issues.push({
          type: 'inefficient_loop',
          severity: 'high',
          file_path: filePath,
          line_start: startLine + 1,
          line_end: i + 1,
          code_snippet: codeSnippet,
          explanation: `Triple-nested loop detected (O(n³) complexity). This will cause severe performance issues with large datasets.`,
          fix_original: codeSnippet,
          fix_suggested: '// Consider using a hash map or Set for O(1) lookups\n// Or restructure the algorithm to reduce nesting',
          fix_explanation: 'Reduce loop nesting by using data structures like Maps or Sets for faster lookups, or refactor the algorithm.',
          impact: 'high',
        });
      }
    }
    
    // Detect loop end (simplified - looks for closing braces)
    if (line.includes('}') && loopDepth > 0) {
      loopStack.pop();
      loopDepth--;
    }
  }

  return issues;
}

/**
 * Detect missing pagination on large data queries
 */
export function detectMissingPagination(filePath: string, content: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const lines = content.split('\n');

  const queryPatterns = [
    /\.find\s*\(\s*\{/,
    /\.findAll\s*\(/,
    /SELECT\s+\*\s+FROM/i,
  ];

  const paginationKeywords = ['limit', 'skip', 'take', 'offset', 'page', 'LIMIT', 'OFFSET'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line contains a query
    const hasQuery = queryPatterns.some(pattern => pattern.test(line));
    
    if (hasQuery) {
      // Check next 5 lines for pagination keywords
      const endLine = Math.min(i + 5, lines.length);
      const contextLines = lines.slice(i, endLine).join('\n');
      const hasPagination = paginationKeywords.some(keyword => 
        contextLines.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (!hasPagination) {
        issues.push({
          type: 'missing_pagination',
          severity: 'medium',
          file_path: filePath,
          line_start: i + 1,
          line_end: i + 1,
          code_snippet: line.trim(),
          explanation: 'Query without pagination detected. Fetching all records can cause memory issues and slow response times with large datasets.',
          fix_original: line.trim(),
          fix_suggested: '// Add pagination: .limit(100).skip(page * 100)',
          fix_explanation: 'Add limit and skip/offset to paginate results and prevent loading all records at once.',
          impact: 'medium',
        });
      }
    }
  }

  return issues;
}

/**
 * Detect missing database indexes based on query patterns
 */
export function detectMissingIndexes(filePath: string, content: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const lines = content.split('\n');

  // Patterns that suggest index usage
  const indexPatterns = [
    { pattern: /\.find\s*\(\s*\{\s*(\w+)\s*:/, field: 1, operation: 'find' },
    { pattern: /WHERE\s+(\w+)\s*=/i, field: 1, operation: 'WHERE' },
    { pattern: /\.sort\s*\(\s*\{\s*(\w+)\s*:/, field: 1, operation: 'sort' },
    { pattern: /ORDER BY\s+(\w+)/i, field: 1, operation: 'ORDER BY' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const { pattern, field, operation } of indexPatterns) {
      const match = line.match(pattern);
      if (match) {
        const fieldName = match[field];
        
        // Check if there's an index hint in comments nearby
        const startLine = Math.max(0, i - 3);
        const endLine = Math.min(i + 3, lines.length);
        const contextLines = lines.slice(startLine, endLine).join('\n');
        const hasIndexComment = /index|indexed|@index/i.test(contextLines);
        
        if (!hasIndexComment && fieldName !== 'id' && fieldName !== '_id') {
          issues.push({
            type: 'missing_index',
            severity: 'medium',
            file_path: filePath,
            line_start: i + 1,
            line_end: i + 1,
            code_snippet: line.trim(),
            explanation: `Query using '${fieldName}' field in ${operation} operation. Consider adding a database index on this field for better performance.`,
            fix_original: line.trim(),
            fix_suggested: `// Add index in migration: CREATE INDEX idx_${fieldName} ON table_name(${fieldName});`,
            fix_explanation: `Create a database index on the '${fieldName}' field to speed up queries that filter or sort by this field.`,
            impact: 'medium',
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Analyze file for all performance anti-patterns
 */
export function analyzePerformance(filePath: string, content: string): PerformanceIssue[] {
  logger.info('Analyzing file for performance issues', { filePath });

  const issues: PerformanceIssue[] = [
    ...detectNPlusOneQueries(filePath, content),
    ...detectSyncInAsync(filePath, content),
    ...detectInefficientLoops(filePath, content),
    ...detectMissingPagination(filePath, content),
    ...detectMissingIndexes(filePath, content),
  ];

  logger.info('Performance analysis complete', {
    filePath,
    issueCount: issues.length,
  });

  return issues;
}

/**
 * Convert performance issues to findings
 */
export function performanceIssuesToFindings(
  projectId: string,
  runId: string,
  issues: PerformanceIssue[]
): Omit<Finding, 'id' | 'created_at'>[] {
  return issues.map(issue => ({
    project_id: projectId,
    run_id: runId,
    requirement_id: null,
    pass_number: 2, // Part of Pass 2 (Bug Detection)
    category: 'performance' as const,
    severity: issue.severity,
    bug_type: issue.type,
    status: 'fail' as const,
    file_path: issue.file_path,
    line_start: issue.line_start,
    line_end: issue.line_end,
    code_snippet: issue.code_snippet,
    explanation: issue.explanation,
    fix_confidence: 0.8,
    fix_original: issue.fix_original,
    fix_suggested: issue.fix_suggested,
    fix_explanation: issue.fix_explanation,
    metadata: {
      performance_impact: issue.impact,
      issue_type: issue.type,
    },
  }));
}
