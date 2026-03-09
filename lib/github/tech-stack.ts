/**
 * Tech Stack Detection
 * 
 * Auto-detects technology stack from repository files:
 * - Node.js/JavaScript/TypeScript (package.json)
 * - Python (requirements.txt, pyproject.toml)
 * - Go (go.mod)
 * - Ruby (Gemfile)
 * - Rust (Cargo.toml)
 * - Java (pom.xml, build.gradle)
 */

import { TechStack } from '@/lib/supabase/types';
import { fetchFileContent } from './client';

/**
 * Detect tech stack from repository files
 * 
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param files - List of file paths in repository
 * @param token - GitHub OAuth token
 * @returns Detected tech stack or null
 */
export async function detectTechStack(
  owner: string,
  repo: string,
  files: string[],
  token: string
): Promise<TechStack | null> {
  // Check for Node.js/JavaScript/TypeScript
  if (files.includes('package.json')) {
    return await detectNodeStack(owner, repo, token);
  }

  // Check for Python
  if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
    return await detectPythonStack(owner, repo, files, token);
  }

  // Check for Go
  if (files.includes('go.mod')) {
    return await detectGoStack(owner, repo, token);
  }

  // Check for Ruby
  if (files.includes('Gemfile')) {
    return await detectRubyStack(owner, repo, token);
  }

  // Check for Rust
  if (files.includes('Cargo.toml')) {
    return await detectRustStack(owner, repo, token);
  }

  // Check for Java (Maven)
  if (files.includes('pom.xml')) {
    return await detectJavaMavenStack(owner, repo, token);
  }

  // Check for Java/Kotlin (Gradle)
  if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
    return await detectJavaGradleStack(owner, repo, token);
  }

  return null;
}

/**
 * Detect Node.js/JavaScript/TypeScript stack from package.json
 */
async function detectNodeStack(
  owner: string,
  repo: string,
  token: string
): Promise<TechStack> {
  try {
    const content = await fetchFileContent(owner, repo, 'package.json', token);
    const packageJson = JSON.parse(content);

    // Detect framework
    let framework = 'Node.js';
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps['next']) framework = 'Next.js';
    else if (deps['react']) framework = 'React';
    else if (deps['vue']) framework = 'Vue.js';
    else if (deps['@angular/core']) framework = 'Angular';
    else if (deps['express']) framework = 'Express';
    else if (deps['fastify']) framework = 'Fastify';
    else if (deps['nestjs']) framework = 'NestJS';
    else if (deps['svelte']) framework = 'Svelte';

    // Detect language (TypeScript vs JavaScript)
    const language = deps['typescript'] ? 'TypeScript' : 'JavaScript';

    // Extract top dependencies
    const dependencies = Object.keys(deps).slice(0, 20);

    return {
      framework,
      language,
      dependencies,
    };
  } catch (error) {
    console.error('Error detecting Node.js stack:', error);
    return {
      framework: 'Node.js',
      language: 'JavaScript',
      dependencies: [],
    };
  }
}

/**
 * Detect Python stack from requirements.txt or pyproject.toml
 */
async function detectPythonStack(
  owner: string,
  repo: string,
  files: string[],
  token: string
): Promise<TechStack> {
  try {
    let dependencies: string[] = [];
    let framework = 'Python';

    // Try requirements.txt first
    if (files.includes('requirements.txt')) {
      const content = await fetchFileContent(owner, repo, 'requirements.txt', token);
      dependencies = content
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.split('==')[0].split('>=')[0].split('<=')[0].trim())
        .slice(0, 20);

      // Detect framework
      if (dependencies.includes('django')) framework = 'Django';
      else if (dependencies.includes('flask')) framework = 'Flask';
      else if (dependencies.includes('fastapi')) framework = 'FastAPI';
      else if (dependencies.includes('tornado')) framework = 'Tornado';
    }
    // Try pyproject.toml
    else if (files.includes('pyproject.toml')) {
      const content = await fetchFileContent(owner, repo, 'pyproject.toml', token);
      // Simple parsing - extract dependency names
      const depMatches = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
      if (depMatches) {
        dependencies = depMatches[1]
          .split(',')
          .map(dep => dep.trim().replace(/['"]/g, '').split('==')[0].split('>=')[0])
          .filter(Boolean)
          .slice(0, 20);
      }
    }

    return {
      framework,
      language: 'Python',
      dependencies,
    };
  } catch (error) {
    console.error('Error detecting Python stack:', error);
    return {
      framework: 'Python',
      language: 'Python',
      dependencies: [],
    };
  }
}

/**
 * Detect Go stack from go.mod
 */
async function detectGoStack(
  owner: string,
  repo: string,
  token: string
): Promise<TechStack> {
  try {
    const content = await fetchFileContent(owner, repo, 'go.mod', token);
    
    // Extract dependencies from go.mod
    const requireMatches = content.match(/require\s+\(([\s\S]*?)\)/);
    let dependencies: string[] = [];

    if (requireMatches) {
      dependencies = requireMatches[1]
        .split('\n')
        .map(line => line.trim().split(' ')[0])
        .filter(Boolean)
        .slice(0, 20);
    }

    // Detect framework
    let framework = 'Go';
    if (dependencies.some(dep => dep.includes('gin-gonic/gin'))) framework = 'Gin';
    else if (dependencies.some(dep => dep.includes('gofiber/fiber'))) framework = 'Fiber';
    else if (dependencies.some(dep => dep.includes('labstack/echo'))) framework = 'Echo';

    return {
      framework,
      language: 'Go',
      dependencies,
    };
  } catch (error) {
    console.error('Error detecting Go stack:', error);
    return {
      framework: 'Go',
      language: 'Go',
      dependencies: [],
    };
  }
}

/**
 * Detect Ruby stack from Gemfile
 */
async function detectRubyStack(
  owner: string,
  repo: string,
  token: string
): Promise<TechStack> {
  try {
    const content = await fetchFileContent(owner, repo, 'Gemfile', token);
    
    // Extract gem names
    const gemMatches = content.match(/gem\s+['"]([^'"]+)['"]/g);
    const dependencies = gemMatches
      ? gemMatches.map(match => match.match(/gem\s+['"]([^'"]+)['"]/)?.[1]).filter(Boolean).slice(0, 20) as string[]
      : [];

    // Detect framework
    let framework = 'Ruby';
    if (dependencies.includes('rails')) framework = 'Ruby on Rails';
    else if (dependencies.includes('sinatra')) framework = 'Sinatra';

    return {
      framework,
      language: 'Ruby',
      dependencies,
    };
  } catch (error) {
    console.error('Error detecting Ruby stack:', error);
    return {
      framework: 'Ruby',
      language: 'Ruby',
      dependencies: [],
    };
  }
}

/**
 * Detect Rust stack from Cargo.toml
 */
async function detectRustStack(
  owner: string,
  repo: string,
  token: string
): Promise<TechStack> {
  try {
    const content = await fetchFileContent(owner, repo, 'Cargo.toml', token);
    
    // Extract dependencies
    const depsMatch = content.match(/\[dependencies\]([\s\S]*?)(\[|$)/);
    const dependencies = depsMatch
      ? depsMatch[1]
          .split('\n')
          .map(line => line.trim().split('=')[0].trim())
          .filter(Boolean)
          .slice(0, 20)
      : [];

    // Detect framework
    let framework = 'Rust';
    if (dependencies.includes('actix-web')) framework = 'Actix Web';
    else if (dependencies.includes('rocket')) framework = 'Rocket';
    else if (dependencies.includes('axum')) framework = 'Axum';

    return {
      framework,
      language: 'Rust',
      dependencies,
    };
  } catch (error) {
    console.error('Error detecting Rust stack:', error);
    return {
      framework: 'Rust',
      language: 'Rust',
      dependencies: [],
    };
  }
}

/**
 * Detect Java Maven stack from pom.xml
 */
async function detectJavaMavenStack(
  owner: string,
  repo: string,
  token: string
): Promise<TechStack> {
  try {
    const content = await fetchFileContent(owner, repo, 'pom.xml', token);
    
    // Extract artifact IDs (simplified parsing)
    const artifactMatches = content.match(/<artifactId>([^<]+)<\/artifactId>/g);
    const dependencies = artifactMatches
      ? artifactMatches
          .map(match => match.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1])
          .filter(Boolean)
          .slice(0, 20) as string[]
      : [];

    // Detect framework
    let framework = 'Java (Maven)';
    if (dependencies.includes('spring-boot-starter-web')) framework = 'Spring Boot';
    else if (dependencies.includes('quarkus-core')) framework = 'Quarkus';

    return {
      framework,
      language: 'Java',
      dependencies,
    };
  } catch (error) {
    console.error('Error detecting Java Maven stack:', error);
    return {
      framework: 'Java (Maven)',
      language: 'Java',
      dependencies: [],
    };
  }
}

/**
 * Detect Java/Kotlin Gradle stack from build.gradle
 */
async function detectJavaGradleStack(
  owner: string,
  repo: string,
  token: string
): Promise<TechStack> {
  try {
    const fileName = 'build.gradle.kts' || 'build.gradle';
    const content = await fetchFileContent(owner, repo, fileName, token);
    
    // Extract dependencies (simplified parsing)
    const depMatches = content.match(/implementation\s*\(?['"]([^'"]+)['"]\)?/g);
    const dependencies = depMatches
      ? depMatches
          .map(match => match.match(/implementation\s*\(?['"]([^'"]+)['"]\)?/)?.[1])
          .filter(Boolean)
          .slice(0, 20) as string[]
      : [];

    // Detect language
    const language = fileName.endsWith('.kts') ? 'Kotlin' : 'Java';

    // Detect framework
    let framework = `${language} (Gradle)`;
    if (dependencies.some(dep => dep.includes('spring-boot'))) framework = 'Spring Boot';
    else if (dependencies.some(dep => dep.includes('ktor'))) framework = 'Ktor';

    return {
      framework,
      language,
      dependencies,
    };
  } catch (error) {
    console.error('Error detecting Java/Kotlin Gradle stack:', error);
    return {
      framework: 'Java (Gradle)',
      language: 'Java',
      dependencies: [],
    };
  }
}
