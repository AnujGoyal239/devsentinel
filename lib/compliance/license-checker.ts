/**
 * License Compliance Checker
 * 
 * Analyzes project dependencies for license compliance issues.
 * Identifies restrictive licenses and flags policy violations.
 */

import { logger } from '@/lib/monitoring/logger';
import { parseDependencies, Dependency } from '@/lib/security/dependency-parser';

export type LicenseType = 'permissive' | 'restrictive' | 'unknown';

export interface LicenseInfo {
  name: string;
  type: LicenseType;
  url?: string;
}

export interface LicenseIssue {
  dependency: Dependency;
  license: LicenseInfo;
  severity: 'high' | 'medium' | 'low';
  explanation: string;
}

/**
 * Common license classifications
 */
const LICENSE_DATABASE: Record<string, LicenseInfo> = {
  // Permissive licenses
  'MIT': { name: 'MIT', type: 'permissive', url: 'https://opensource.org/licenses/MIT' },
  'Apache-2.0': { name: 'Apache 2.0', type: 'permissive', url: 'https://opensource.org/licenses/Apache-2.0' },
  'BSD-2-Clause': { name: 'BSD 2-Clause', type: 'permissive', url: 'https://opensource.org/licenses/BSD-2-Clause' },
  'BSD-3-Clause': { name: 'BSD 3-Clause', type: 'permissive', url: 'https://opensource.org/licenses/BSD-3-Clause' },
  'ISC': { name: 'ISC', type: 'permissive', url: 'https://opensource.org/licenses/ISC' },
  'Unlicense': { name: 'Unlicense', type: 'permissive', url: 'https://unlicense.org/' },
  '0BSD': { name: '0BSD', type: 'permissive', url: 'https://opensource.org/licenses/0BSD' },
  
  // Restrictive licenses (copyleft)
  'GPL-2.0': { name: 'GPL 2.0', type: 'restrictive', url: 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html' },
  'GPL-3.0': { name: 'GPL 3.0', type: 'restrictive', url: 'https://www.gnu.org/licenses/gpl-3.0.html' },
  'AGPL-3.0': { name: 'AGPL 3.0', type: 'restrictive', url: 'https://www.gnu.org/licenses/agpl-3.0.html' },
  'LGPL-2.1': { name: 'LGPL 2.1', type: 'restrictive', url: 'https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html' },
  'LGPL-3.0': { name: 'LGPL 3.0', type: 'restrictive', url: 'https://www.gnu.org/licenses/lgpl-3.0.html' },
  'MPL-2.0': { name: 'MPL 2.0', type: 'restrictive', url: 'https://www.mozilla.org/en-US/MPL/2.0/' },
  'EPL-1.0': { name: 'EPL 1.0', type: 'restrictive', url: 'https://www.eclipse.org/legal/epl-v10.html' },
  'EPL-2.0': { name: 'EPL 2.0', type: 'restrictive', url: 'https://www.eclipse.org/legal/epl-2.0/' },
  'CDDL-1.0': { name: 'CDDL 1.0', type: 'restrictive', url: 'https://opensource.org/licenses/CDDL-1.0' },
};

/**
 * Extract license from package.json content
 */
function extractLicenseFromPackageJson(content: string): Map<string, string> {
  const licenses = new Map<string, string>();
  
  try {
    const packageJson = JSON.parse(content);
    
    // Check dependencies
    if (packageJson.dependencies) {
      for (const [name] of Object.entries(packageJson.dependencies)) {
        // In a real implementation, we would fetch the license from npm registry
        // For now, we'll mark as unknown
        licenses.set(name, 'UNKNOWN');
      }
    }
    
    // Check devDependencies
    if (packageJson.devDependencies) {
      for (const [name] of Object.entries(packageJson.devDependencies)) {
        licenses.set(name, 'UNKNOWN');
      }
    }
  } catch (error) {
    logger.error('Error parsing package.json for licenses', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  
  return licenses;
}

/**
 * Parse license information from package-lock.json
 */
function extractLicensesFromPackageLock(content: string): Map<string, string> {
  const licenses = new Map<string, string>();
  
  try {
    const lockfile = JSON.parse(content);
    
    // package-lock.json v2+ format
    if (lockfile.packages) {
      for (const [path, pkg] of Object.entries(lockfile.packages as Record<string, any>)) {
        if (path === '') continue; // Skip root package
        
        const name = pkg.name || path.replace('node_modules/', '');
        const license = pkg.license || 'UNKNOWN';
        
        licenses.set(name, license);
      }
    }
    
    // package-lock.json v1 format
    if (lockfile.dependencies) {
      for (const [name, pkg] of Object.entries(lockfile.dependencies as Record<string, any>)) {
        const license = pkg.license || pkg.licenses || 'UNKNOWN';
        licenses.set(name, typeof license === 'string' ? license : 'UNKNOWN');
      }
    }
  } catch (error) {
    logger.error('Error parsing package-lock.json for licenses', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  
  return licenses;
}

/**
 * Classify license type
 */
function classifyLicense(licenseString: string): LicenseInfo {
  const normalized = licenseString.toUpperCase().trim();
  
  // Check exact matches
  for (const [key, info] of Object.entries(LICENSE_DATABASE)) {
    if (normalized === key.toUpperCase() || normalized.includes(key.toUpperCase())) {
      return info;
    }
  }
  
  // Check for common patterns
  if (normalized.includes('GPL') || normalized.includes('AGPL')) {
    return { name: licenseString, type: 'restrictive' };
  }
  
  if (normalized.includes('MIT') || normalized.includes('BSD') || normalized.includes('APACHE')) {
    return { name: licenseString, type: 'permissive' };
  }
  
  return { name: licenseString, type: 'unknown' };
}

/**
 * Check if license violates policy
 */
function checkLicensePolicy(
  dependency: Dependency,
  license: LicenseInfo,
  allowedLicenses?: string[]
): LicenseIssue | null {
  // If allowed licenses are specified, check against them
  if (allowedLicenses && allowedLicenses.length > 0) {
    const isAllowed = allowedLicenses.some(allowed => {
      const allowedUpper = allowed.toUpperCase().replace(/[.\s-]/g, '');
      const licenseUpper = license.name.toUpperCase().replace(/[.\s-]/g, '');
      return licenseUpper.includes(allowedUpper) || allowedUpper.includes(licenseUpper);
    });
    
    if (!isAllowed) {
      return {
        dependency,
        license,
        severity: license.type === 'restrictive' ? 'high' : 'medium',
        explanation: `Dependency '${dependency.name}' uses license '${license.name}' which is not in the allowed license list.`,
      };
    }
    
    // If allowed, don't flag even if restrictive
    return null;
  }
  
  // Flag restrictive licenses
  if (license.type === 'restrictive') {
    return {
      dependency,
      license,
      severity: 'high',
      explanation: `Dependency '${dependency.name}' uses restrictive license '${license.name}' (${getLicenseDescription(license.name)}). This may require you to open-source your code.`,
    };
  }
  
  // Flag unknown licenses
  if (license.type === 'unknown' && license.name !== 'UNKNOWN') {
    return {
      dependency,
      license,
      severity: 'low',
      explanation: `Dependency '${dependency.name}' uses unknown or uncommon license '${license.name}'. Review the license terms manually.`,
    };
  }
  
  // Flag missing licenses
  if (license.name === 'UNKNOWN') {
    return {
      dependency,
      license,
      severity: 'medium',
      explanation: `Dependency '${dependency.name}' has no license information. This may pose legal risks.`,
    };
  }
  
  return null;
}

/**
 * Get human-readable license description
 */
function getLicenseDescription(licenseName: string): string {
  const upper = licenseName.toUpperCase();
  
  if (upper.includes('GPL')) {
    return 'copyleft license requiring derivative works to be open-sourced';
  }
  
  if (upper.includes('AGPL')) {
    return 'strong copyleft license requiring network-accessible code to be open-sourced';
  }
  
  if (upper.includes('LGPL')) {
    return 'weak copyleft license allowing dynamic linking without open-sourcing';
  }
  
  if (upper.includes('MPL')) {
    return 'weak copyleft license requiring modified files to be open-sourced';
  }
  
  return 'copyleft license with specific requirements';
}

/**
 * Analyze package-lock.json for license compliance
 */
export function analyzeLicenseCompliance(
  filename: string,
  content: string,
  allowedLicenses?: string[]
): LicenseIssue[] {
  logger.info('Analyzing license compliance', { filename });
  
  const issues: LicenseIssue[] = [];
  
  // Extract licenses based on file type
  let licenses: Map<string, string>;
  
  if (filename.toLowerCase() === 'package-lock.json') {
    licenses = extractLicensesFromPackageLock(content);
    
    // For package-lock.json, we already have all the info we need
    for (const [name, licenseString] of licenses.entries()) {
      const license = classifyLicense(licenseString);
      
      // Create a dependency object
      const dependency: Dependency = {
        name,
        version: '1.0.0', // Version not critical for license checking
        ecosystem: 'npm',
        isDev: false,
      };
      
      const issue = checkLicensePolicy(dependency, license, allowedLicenses);
      if (issue) {
        issues.push(issue);
      }
    }
  } else if (filename.toLowerCase() === 'package.json') {
    licenses = extractLicenseFromPackageJson(content);
    
    // Parse dependencies from package.json
    const dependencies = parseDependencies(filename, content);
    
    // Check each dependency
    for (const dependency of dependencies) {
      const licenseString = licenses.get(dependency.name) || 'UNKNOWN';
      const license = classifyLicense(licenseString);
      
      const issue = checkLicensePolicy(dependency, license, allowedLicenses);
      if (issue) {
        issues.push(issue);
      }
    }
  } else {
    logger.warn('Unsupported file for license analysis', { filename });
    return [];
  }
  
  logger.info('License compliance analysis complete', {
    filename,
    totalDependencies: licenses.size,
    issuesFound: issues.length,
  });
  
  return issues;
}

/**
 * Get license statistics
 */
export function getLicenseStatistics(issues: LicenseIssue[]): {
  permissive: number;
  restrictive: number;
  unknown: number;
  total: number;
} {
  const stats = {
    permissive: 0,
    restrictive: 0,
    unknown: 0,
    total: issues.length,
  };
  
  for (const issue of issues) {
    if (issue.license.type === 'permissive') {
      stats.permissive++;
    } else if (issue.license.type === 'restrictive') {
      stats.restrictive++;
    } else {
      stats.unknown++;
    }
  }
  
  return stats;
}
