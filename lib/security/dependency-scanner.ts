/**
 * Dependency Vulnerability Scanner
 * 
 * Scans project dependencies for known vulnerabilities using OSV API.
 */

import { parseDependencies, Dependency } from './dependency-parser';
import { queryVulnerabilities, batchQueryVulnerabilities, Vulnerability } from './osv-client';
import { logger } from '@/lib/monitoring/logger';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface DependencyScanResult {
  dependency: Dependency;
  vulnerabilities: Vulnerability[];
}

/**
 * Scan dependencies from file content
 */
export async function scanDependencyFile(
  filename: string,
  content: string
): Promise<DependencyScanResult[]> {
  // Parse dependencies from file
  const dependencies = parseDependencies(filename, content);

  if (dependencies.length === 0) {
    logger.info('No dependencies found in file', { filename });
    return [];
  }

  logger.info('Scanning dependencies for vulnerabilities', {
    filename,
    dependencyCount: dependencies.length,
  });

  // Query vulnerabilities for all dependencies
  const results = await batchQueryVulnerabilities(
    dependencies.map((dep) => ({
      name: dep.name,
      version: dep.version,
      ecosystem: dep.ecosystem,
    }))
  );

  // Combine dependencies with their vulnerabilities
  const scanResults: DependencyScanResult[] = [];
  for (let i = 0; i < dependencies.length; i++) {
    const dependency = dependencies[i];
    const result = results[i];

    if (result && result.vulnerabilities.length > 0) {
      scanResults.push({
        dependency,
        vulnerabilities: result.vulnerabilities,
      });
    }
  }

  logger.info('Dependency scan completed', {
    filename,
    totalDependencies: dependencies.length,
    vulnerableDependencies: scanResults.length,
    totalVulnerabilities: scanResults.reduce((sum, r) => sum + r.vulnerabilities.length, 0),
  });

  return scanResults;
}

/**
 * Create findings from dependency scan results
 */
export async function createDependencyFindings(
  projectId: string,
  runId: string,
  filename: string,
  scanResults: DependencyScanResult[]
): Promise<void> {
  const findings = [];

  for (const result of scanResults) {
    const { dependency, vulnerabilities } = result;

    for (const vuln of vulnerabilities) {
      // Map OSV severity to our severity levels
      const severity = mapSeverity(vuln.severity);

      // Create finding explanation
      const explanation = `Dependency \`${dependency.name}@${dependency.version}\` has a known vulnerability: ${vuln.summary}`;

      // Create fix suggestion
      const fixSuggestion = vuln.fixed_version
        ? `Upgrade \`${dependency.name}\` to version \`${vuln.fixed_version}\` or later to fix this vulnerability.`
        : `Review the vulnerability details and consider upgrading \`${dependency.name}\` to a patched version.`;

      // Create code snippet showing the dependency declaration
      const codeSnippet = createDependencySnippet(filename, dependency);

      findings.push({
        project_id: projectId,
        run_id: runId,
        category: 'security',
        bug_type: 'Vulnerable Dependency',
        severity,
        file_path: filename,
        line_start: 1,
        line_end: 1,
        code_snippet: codeSnippet,
        explanation,
        fix_original: codeSnippet,
        fix_suggested: createFixedDependencySnippet(filename, dependency, vuln.fixed_version),
        fix_explanation: fixSuggestion,
        status: 'fail',
        pass_number: 3, // Security audit pass
        metadata: {
          cve_id: vuln.id,
          cvss_score: vuln.cvss_score,
          affected_versions: vuln.affected_versions,
          fixed_version: vuln.fixed_version,
          references: vuln.references,
          published: vuln.published,
          dependency_name: dependency.name,
          dependency_version: dependency.version,
          ecosystem: dependency.ecosystem,
        },
      });
    }
  }

  if (findings.length > 0) {
    const { error } = await supabaseAdmin.from('findings').insert(findings);

    if (error) {
      logger.error('Failed to create dependency findings', {
        error: error.message,
        projectId,
        runId,
        findingCount: findings.length,
      });
    } else {
      logger.info('Created dependency findings', {
        projectId,
        runId,
        findingCount: findings.length,
      });
    }
  }
}

/**
 * Map OSV severity to our severity levels
 */
function mapSeverity(osvSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): 'critical' | 'high' | 'medium' | 'low' {
  return osvSeverity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Create code snippet showing dependency declaration
 */
function createDependencySnippet(filename: string, dependency: Dependency): string {
  const lowerFilename = filename.toLowerCase();

  if (lowerFilename === 'package.json') {
    return `"${dependency.name}": "${dependency.version}"`;
  }

  if (lowerFilename === 'requirements.txt') {
    return `${dependency.name}==${dependency.version}`;
  }

  if (lowerFilename === 'go.mod') {
    return `${dependency.name} v${dependency.version}`;
  }

  if (lowerFilename === 'gemfile.lock') {
    return `${dependency.name} (${dependency.version})`;
  }

  return `${dependency.name}@${dependency.version}`;
}

/**
 * Create fixed dependency snippet
 */
function createFixedDependencySnippet(
  filename: string,
  dependency: Dependency,
  fixedVersion?: string
): string {
  if (!fixedVersion) {
    return createDependencySnippet(filename, dependency);
  }

  const lowerFilename = filename.toLowerCase();

  if (lowerFilename === 'package.json') {
    return `"${dependency.name}": "${fixedVersion}"`;
  }

  if (lowerFilename === 'requirements.txt') {
    return `${dependency.name}==${fixedVersion}`;
  }

  if (lowerFilename === 'go.mod') {
    return `${dependency.name} v${fixedVersion}`;
  }

  if (lowerFilename === 'gemfile.lock') {
    return `${dependency.name} (${fixedVersion})`;
  }

  return `${dependency.name}@${fixedVersion}`;
}
