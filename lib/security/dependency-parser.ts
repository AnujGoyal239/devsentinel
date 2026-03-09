/**
 * Dependency Parser
 * 
 * Parses dependency files from various ecosystems and extracts package information.
 */

import { logger } from '@/lib/monitoring/logger';

export interface Dependency {
  name: string;
  version: string;
  ecosystem: 'npm' | 'PyPI' | 'Go' | 'RubyGems';
  isDev?: boolean;
}

/**
 * Parse package.json for npm dependencies
 */
export function parsePackageJson(content: string): Dependency[] {
  try {
    const packageJson = JSON.parse(content);
    const dependencies: Dependency[] = [];

    // Parse production dependencies
    if (packageJson.dependencies && typeof packageJson.dependencies === 'object') {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        if (typeof version === 'string') {
          const cleanVersion = cleanVersionString(version);
          if (cleanVersion) {
            dependencies.push({
              name,
              version: cleanVersion,
              ecosystem: 'npm',
              isDev: false,
            });
          }
        }
      }
    }

    // Parse dev dependencies
    if (packageJson.devDependencies && typeof packageJson.devDependencies === 'object') {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        if (typeof version === 'string') {
          const cleanVersion = cleanVersionString(version);
          if (cleanVersion) {
            dependencies.push({
              name,
              version: cleanVersion,
              ecosystem: 'npm',
              isDev: true,
            });
          }
        }
      }
    }

    logger.info('Parsed package.json', { dependencyCount: dependencies.length });
    return dependencies;
  } catch (error) {
    logger.error('Error parsing package.json', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Parse requirements.txt for Python dependencies
 */
export function parseRequirementsTxt(content: string): Dependency[] {
  try {
    const dependencies: Dependency[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse package==version or package>=version format
      const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*([=><~!]+)\s*([0-9.]+)/);
      if (match) {
        const [, name, operator, version] = match;
        
        // Only include exact versions or minimum versions
        if (operator === '==' || operator === '>=') {
          dependencies.push({
            name,
            version,
            ecosystem: 'PyPI',
            isDev: false,
          });
        }
      }
    }

    logger.info('Parsed requirements.txt', { dependencyCount: dependencies.length });
    return dependencies;
  } catch (error) {
    logger.error('Error parsing requirements.txt', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Parse go.mod for Go dependencies
 */
export function parseGoMod(content: string): Dependency[] {
  try {
    const dependencies: Dependency[] = [];
    const lines = content.split('\n');
    let inRequireBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for require block
      if (trimmed.startsWith('require (')) {
        inRequireBlock = true;
        continue;
      }

      if (inRequireBlock && trimmed === ')') {
        inRequireBlock = false;
        continue;
      }

      // Parse require statements
      if (inRequireBlock || trimmed.startsWith('require ')) {
        const match = trimmed.match(/([a-zA-Z0-9._/-]+)\s+v([0-9.]+)/);
        if (match) {
          const [, name, version] = match;
          dependencies.push({
            name,
            version,
            ecosystem: 'Go',
            isDev: false,
          });
        }
      }
    }

    logger.info('Parsed go.mod', { dependencyCount: dependencies.length });
    return dependencies;
  } catch (error) {
    logger.error('Error parsing go.mod', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Parse Gemfile.lock for Ruby dependencies
 */
export function parseGemfileLock(content: string): Dependency[] {
  try {
    const dependencies: Dependency[] = [];
    const lines = content.split('\n');
    let inSpecsSection = false;

    for (const line of lines) {
      // Check for specs: section (where gems are listed)
      if (line.trim() === 'specs:') {
        inSpecsSection = true;
        continue;
      }

      // Exit specs section when we hit a non-indented line
      if (inSpecsSection && line.length > 0 && !line.startsWith(' ')) {
        inSpecsSection = false;
      }

      // Parse gem entries (they are indented)
      if (inSpecsSection && line.trim()) {
        const match = line.match(/([a-zA-Z0-9_-]+)\s+\(([0-9.]+)\)/);
        if (match) {
          const [, name, version] = match;
          dependencies.push({
            name,
            version,
            ecosystem: 'RubyGems',
            isDev: false,
          });
        }
      }
    }

    logger.info('Parsed Gemfile.lock', { dependencyCount: dependencies.length });
    return dependencies;
  } catch (error) {
    logger.error('Error parsing Gemfile.lock', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Clean version string by removing prefixes and ranges
 */
function cleanVersionString(version: string): string | null {
  // Remove common prefixes
  let cleaned = version.replace(/^[\^~>=<]+/, '');
  
  // Extract first version number if range
  const match = cleaned.match(/([0-9]+\.[0-9]+\.[0-9]+)/);
  if (match) {
    return match[1];
  }

  // Return as-is if it looks like a version
  if (/^[0-9]+\.[0-9]+/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

/**
 * Parse dependencies from file content based on filename
 */
export function parseDependencies(filename: string, content: string): Dependency[] {
  const lowerFilename = filename.toLowerCase();

  if (lowerFilename === 'package.json') {
    return parsePackageJson(content);
  }

  if (lowerFilename === 'requirements.txt') {
    return parseRequirementsTxt(content);
  }

  if (lowerFilename === 'go.mod') {
    return parseGoMod(content);
  }

  if (lowerFilename === 'gemfile.lock') {
    return parseGemfileLock(content);
  }

  logger.warn('Unknown dependency file format', { filename });
  return [];
}
