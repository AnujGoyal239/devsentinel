/**
 * Code Coverage Parser
 * 
 * Parses code coverage reports in LCOV and Cobertura formats.
 * Stores coverage data per file and line for integration with findings.
 */

import { logger } from '@/lib/monitoring/logger';

export interface LineCoverage {
  line: number;
  hits: number;
  covered: boolean;
}

export interface FileCoverage {
  file_path: string;
  lines_total: number;
  lines_covered: number;
  coverage_percentage: number;
  line_coverage: LineCoverage[];
}

export interface CoverageReport {
  files: FileCoverage[];
  total_lines: number;
  covered_lines: number;
  overall_percentage: number;
}

/**
 * Parse LCOV format coverage report
 * 
 * LCOV format example:
 * SF:path/to/file.ts
 * DA:1,1
 * DA:2,0
 * LF:10
 * LH:8
 * end_of_record
 */
export function parseLCOV(content: string): CoverageReport {
  const files: FileCoverage[] = [];
  const lines = content.split('\n');
  
  let currentFile: Partial<FileCoverage> | null = null;
  let currentLines: LineCoverage[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('SF:')) {
      // Start of file record
      const filePath = trimmed.substring(3);
      currentFile = {
        file_path: filePath,
        line_coverage: [],
      };
      currentLines = [];
    } else if (trimmed.startsWith('DA:')) {
      // Line coverage data: DA:line_number,hit_count
      const match = trimmed.match(/DA:(\d+),(\d+)/);
      if (match && currentFile) {
        const lineNum = parseInt(match[1], 10);
        const hits = parseInt(match[2], 10);
        currentLines.push({
          line: lineNum,
          hits,
          covered: hits > 0,
        });
      }
    } else if (trimmed.startsWith('LF:')) {
      // Lines found (total)
      const total = parseInt(trimmed.substring(3), 10);
      if (currentFile) {
        currentFile.lines_total = total;
      }
    } else if (trimmed.startsWith('LH:')) {
      // Lines hit (covered)
      const covered = parseInt(trimmed.substring(3), 10);
      if (currentFile) {
        currentFile.lines_covered = covered;
      }
    } else if (trimmed === 'end_of_record') {
      // End of file record
      if (currentFile && currentFile.file_path) {
        const total = currentFile.lines_total || currentLines.length;
        const covered = currentFile.lines_covered || currentLines.filter(l => l.covered).length;
        
        files.push({
          file_path: currentFile.file_path,
          lines_total: total,
          lines_covered: covered,
          coverage_percentage: total > 0 ? (covered / total) * 100 : 0,
          line_coverage: currentLines,
        });
      }
      currentFile = null;
      currentLines = [];
    }
  }
  
  // Calculate overall statistics
  const totalLines = files.reduce((sum, f) => sum + f.lines_total, 0);
  const coveredLines = files.reduce((sum, f) => sum + f.lines_covered, 0);
  const overallPercentage = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
  
  logger.info('Parsed LCOV coverage report', {
    fileCount: files.length,
    totalLines,
    coveredLines,
    overallPercentage: overallPercentage.toFixed(2),
  });
  
  return {
    files,
    total_lines: totalLines,
    covered_lines: coveredLines,
    overall_percentage: overallPercentage,
  };
}

/**
 * Parse Cobertura XML format coverage report
 * 
 * Simplified parser for Cobertura format
 */
export function parseCobertura(content: string): CoverageReport {
  const files: FileCoverage[] = [];
  
  try {
    // Simple regex-based parsing (in production, use a proper XML parser)
    const classMatches = content.matchAll(/<class[^>]*filename="([^"]+)"[^>]*line-rate="([^"]+)"[^>]*>/g);
    
    for (const match of classMatches) {
      const filePath = match[1];
      const lineRate = parseFloat(match[2]);
      
      // Extract line coverage for this class
      const classStart = match.index || 0;
      const classEnd = content.indexOf('</class>', classStart);
      const classContent = content.substring(classStart, classEnd);
      
      const lineMatches = classContent.matchAll(/<line number="(\d+)" hits="(\d+)"[^>]*\/>/g);
      const lineCoverage: LineCoverage[] = [];
      
      for (const lineMatch of lineMatches) {
        const lineNum = parseInt(lineMatch[1], 10);
        const hits = parseInt(lineMatch[2], 10);
        lineCoverage.push({
          line: lineNum,
          hits,
          covered: hits > 0,
        });
      }
      
      const total = lineCoverage.length;
      const covered = lineCoverage.filter(l => l.covered).length;
      
      files.push({
        file_path: filePath,
        lines_total: total,
        lines_covered: covered,
        coverage_percentage: lineRate * 100,
        line_coverage: lineCoverage,
      });
    }
    
    // Calculate overall statistics
    const totalLines = files.reduce((sum, f) => sum + f.lines_total, 0);
    const coveredLines = files.reduce((sum, f) => sum + f.lines_covered, 0);
    const overallPercentage = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
    
    logger.info('Parsed Cobertura coverage report', {
      fileCount: files.length,
      totalLines,
      coveredLines,
      overallPercentage: overallPercentage.toFixed(2),
    });
    
    return {
      files,
      total_lines: totalLines,
      covered_lines: coveredLines,
      overall_percentage: overallPercentage,
    };
  } catch (error) {
    logger.error('Error parsing Cobertura coverage report', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      files: [],
      total_lines: 0,
      covered_lines: 0,
      overall_percentage: 0,
    };
  }
}

/**
 * Parse coverage report based on format
 */
export function parseCoverageReport(content: string, format: 'lcov' | 'cobertura'): CoverageReport {
  if (format === 'lcov') {
    return parseLCOV(content);
  } else if (format === 'cobertura') {
    return parseCobertura(content);
  } else {
    logger.error('Unsupported coverage format', { format });
    return {
      files: [],
      total_lines: 0,
      covered_lines: 0,
      overall_percentage: 0,
    };
  }
}

/**
 * Get coverage status for a specific line
 */
export function getLineCoverageStatus(
  coverage: CoverageReport,
  filePath: string,
  lineNumber: number
): 'covered' | 'uncovered' | 'partial' | 'unknown' {
  const file = coverage.files.find(f => f.file_path === filePath || f.file_path.endsWith(filePath));
  
  if (!file) {
    return 'unknown';
  }
  
  const line = file.line_coverage.find(l => l.line === lineNumber);
  
  if (!line) {
    return 'unknown';
  }
  
  if (line.hits === 0) {
    return 'uncovered';
  } else if (line.hits === 1) {
    return 'partial';
  } else {
    return 'covered';
  }
}

/**
 * Get coverage status for a range of lines
 */
export function getRangeCoverageStatus(
  coverage: CoverageReport,
  filePath: string,
  startLine: number,
  endLine: number
): 'covered' | 'uncovered' | 'partial' | 'unknown' {
  const file = coverage.files.find(f => f.file_path === filePath || f.file_path.endsWith(filePath));
  
  if (!file) {
    return 'unknown';
  }
  
  const relevantLines = file.line_coverage.filter(
    l => l.line >= startLine && l.line <= endLine
  );
  
  if (relevantLines.length === 0) {
    return 'unknown';
  }
  
  const allCovered = relevantLines.every(l => l.covered);
  const noneCovered = relevantLines.every(l => !l.covered);
  
  if (allCovered) {
    return 'covered';
  } else if (noneCovered) {
    return 'uncovered';
  } else {
    return 'partial';
  }
}

/**
 * Get file coverage percentage
 */
export function getFileCoveragePercentage(
  coverage: CoverageReport,
  filePath: string
): number {
  const file = coverage.files.find(f => f.file_path === filePath || f.file_path.endsWith(filePath));
  return file?.coverage_percentage || 0;
}
