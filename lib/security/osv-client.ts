/**
 * OSV (Open Source Vulnerabilities) API Client
 * 
 * Queries the OSV database for known vulnerabilities in dependencies.
 * API Documentation: https://osv.dev/docs/
 */

import { logger } from '@/lib/monitoring/logger';

export interface Vulnerability {
  id: string; // CVE or GHSA identifier
  summary: string;
  details: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cvss_score?: number;
  affected_versions: string[];
  fixed_version?: string;
  references: string[];
  published: string;
}

export interface VulnerabilityQueryResult {
  package_name: string;
  package_version: string;
  ecosystem: 'npm' | 'PyPI' | 'Go' | 'RubyGems';
  vulnerabilities: Vulnerability[];
}

const OSV_API_URL = 'https://api.osv.dev/v1';

/**
 * Query OSV API for vulnerabilities in a specific package version
 */
export async function queryVulnerabilities(
  packageName: string,
  version: string,
  ecosystem: 'npm' | 'PyPI' | 'Go' | 'RubyGems'
): Promise<VulnerabilityQueryResult> {
  try {
    const response = await fetch(`${OSV_API_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        package: {
          name: packageName,
          ecosystem,
        },
        version,
      }),
    });

    if (!response.ok) {
      logger.error('OSV API request failed', {
        status: response.status,
        packageName,
        version,
        ecosystem,
      });
      return {
        package_name: packageName,
        package_version: version,
        ecosystem,
        vulnerabilities: [],
      };
    }

    const data = await response.json();
    const vulnerabilities: Vulnerability[] = [];

    if (data.vulns && Array.isArray(data.vulns)) {
      for (const vuln of data.vulns) {
        // Extract severity from database_specific or severity field
        let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
        let cvssScore: number | undefined;

        if (vuln.severity && Array.isArray(vuln.severity)) {
          const cvssEntry = vuln.severity.find((s: any) => s.type === 'CVSS_V3');
          if (cvssEntry && cvssEntry.score) {
            cvssScore = parseFloat(cvssEntry.score);
            severity = cvssScoreToSeverity(cvssScore);
          }
        }

        // Extract affected versions
        const affectedVersions: string[] = [];
        if (vuln.affected && Array.isArray(vuln.affected)) {
          for (const affected of vuln.affected) {
            if (affected.ranges && Array.isArray(affected.ranges)) {
              for (const range of affected.ranges) {
                if (range.events && Array.isArray(range.events)) {
                  for (const event of range.events) {
                    if (event.introduced) {
                      affectedVersions.push(`>=${event.introduced}`);
                    }
                    if (event.fixed) {
                      affectedVersions.push(`<${event.fixed}`);
                    }
                  }
                }
              }
            }
          }
        }

        // Extract fixed version
        let fixedVersion: string | undefined;
        if (vuln.affected && Array.isArray(vuln.affected)) {
          for (const affected of vuln.affected) {
            if (affected.ranges && Array.isArray(affected.ranges)) {
              for (const range of affected.ranges) {
                if (range.events && Array.isArray(range.events)) {
                  const fixedEvent = range.events.find((e: any) => e.fixed);
                  if (fixedEvent && fixedEvent.fixed) {
                    fixedVersion = fixedEvent.fixed;
                    break;
                  }
                }
              }
            }
          }
        }

        // Extract references
        const references: string[] = [];
        if (vuln.references && Array.isArray(vuln.references)) {
          for (const ref of vuln.references) {
            if (ref.url) {
              references.push(ref.url);
            }
          }
        }

        vulnerabilities.push({
          id: vuln.id || 'UNKNOWN',
          summary: vuln.summary || 'No summary available',
          details: vuln.details || vuln.summary || 'No details available',
          severity,
          cvss_score: cvssScore,
          affected_versions: affectedVersions,
          fixed_version: fixedVersion,
          references,
          published: vuln.published || new Date().toISOString(),
        });
      }
    }

    logger.info('OSV vulnerability query completed', {
      packageName,
      version,
      ecosystem,
      vulnerabilityCount: vulnerabilities.length,
    });

    return {
      package_name: packageName,
      package_version: version,
      ecosystem,
      vulnerabilities,
    };
  } catch (error) {
    logger.error('Error querying OSV API', {
      error: error instanceof Error ? error.message : 'Unknown error',
      packageName,
      version,
      ecosystem,
    });
    return {
      package_name: packageName,
      package_version: version,
      ecosystem,
      vulnerabilities: [],
    };
  }
}

/**
 * Convert CVSS score to severity level
 */
function cvssScoreToSeverity(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  return 'LOW';
}

/**
 * Batch query vulnerabilities for multiple packages
 */
export async function batchQueryVulnerabilities(
  packages: Array<{
    name: string;
    version: string;
    ecosystem: 'npm' | 'PyPI' | 'Go' | 'RubyGems';
  }>
): Promise<VulnerabilityQueryResult[]> {
  const results: VulnerabilityQueryResult[] = [];

  // Process in batches of 10 to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < packages.length; i += batchSize) {
    const batch = packages.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((pkg) => queryVulnerabilities(pkg.name, pkg.version, pkg.ecosystem))
    );
    results.push(...batchResults);
  }

  return results;
}
