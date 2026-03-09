/**
 * Analysis Pipeline Inngest Function
 * 
 * Orchestrates the 4-pass AI analysis pipeline:
 * - Pass 1: Codebase Understanding
 * - Pass 2: Bug Detection + PRD Compliance
 * - Pass 3: Security Audit
 * - Pass 4: Production Readiness Audit
 * 
 * Each step is independently resumable for fault tolerance.
 */

import { inngest } from '../client';
import { supabase } from '@/lib/supabase/server';
import { fetchRepoTree, fetchFileContent } from '@/lib/github/client';
import type { CodebaseContext, TechStack, Project, Requirement, Finding, FindingSeverity } from '@/lib/supabase/types';
import { generateCompletion } from '@/lib/ai/groq-client';
import { searchSimilarFiles } from '@/lib/vector/qdrant';
import { sendAnalysisCompleteEmail, sendAnalysisFailedEmail } from '@/lib/email/notifications';
import { scanDependencyFile, createDependencyFindings } from '@/lib/security/dependency-scanner';
import { analyzePerformance, performanceIssuesToFindings } from '@/lib/performance/analyzer';
import { executeCustomRules, convertMatchesToFindings } from '@/lib/custom-rules';
import type { CustomRule } from '@/lib/custom-rules';

/**
 * Analysis pipeline event data
 */
interface AnalysisRunEvent {
  project_id: string;
  run_id: string;
  document_id?: string;
}

/**
 * Fetch repository tree and key files
 */
async function fetchRepoData(projectId: string) {
  // Get project details
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // Get user's GitHub token
  const { data: user } = await supabase
    .from('users')
    .select('github_token')
    .eq('id', project.user_id)
    .single();

  if (!user?.github_token) {
    throw new Error('GitHub token not found for user');
  }

  // Fetch file tree
  const fileTree = await fetchRepoTree(
    project.repo_owner,
    project.repo_name,
    project.branch,
    user.github_token
  );

  // Fetch key files
  const keyFiles: Record<string, string> = {};
  const keyFilePaths = [
    'package.json',
    'requirements.txt',
    'go.mod',
    'Gemfile',
    'pom.xml',
    'README.md',
  ];

  for (const path of keyFilePaths) {
    const fileExists = fileTree.files.some(f => f.path === path);
    if (fileExists) {
      try {
        const content = await fetchFileContent(
          project.repo_owner,
          project.repo_name,
          path,
          user.github_token
        );
        keyFiles[path] = content;
      } catch (error) {
        console.error(`Failed to fetch ${path}:`, error);
      }
    }
  }

  return { project, fileTree, keyFiles, githubToken: user.github_token };
}

/**
 * Run Pass 1: Codebase Understanding
 * 
 * Analyzes the repository structure and key files to extract:
 * - Tech stack (framework, language, dependencies)
 * - API routes with methods, paths, files, and line numbers
 * - Frontend pages
 * - Authentication middleware patterns
 * - Database models
 * - Broken import statements
 */
async function runPass1(
  fileTree: { files: Array<{ path: string; type: string }> },
  keyFiles: Record<string, string>
): Promise<CodebaseContext> {
  // Build file tree summary
  const fileTreeSummary = fileTree.files
    .slice(0, 200)
    .map(f => f.path)
    .join('\n');

  const fileTreeExtra = fileTree.files.length > 200 
    ? `\n... and ${fileTree.files.length - 200} more files` 
    : '';

  // Build key files content
  const keyFilesContent = Object.entries(keyFiles)
    .map(([path, content]) => {
      const truncated = content.length > 3000 ? content.slice(0, 3000) + '\n... (truncated)' : content;
      return `\n=== ${path} ===\n${truncated}`;
    })
    .join('\n\n');

  const prompt = `You are a senior software architect analyzing a codebase. Extract structured information about the project architecture.

REPOSITORY FILE TREE (${fileTree.files.length} files total):
${fileTreeSummary}${fileTreeExtra}

KEY FILES CONTENT:
${keyFilesContent}

TASK: Analyze the codebase structure and extract the following information:

1. **Tech Stack**: Identify the framework (Next.js, Express, Django, Rails, etc.), primary language, and major dependencies
2. **API Routes**: Find all backend API endpoints with HTTP method, path, file location, and approximate line number
3. **Frontend Pages**: Identify all frontend routes/pages and their source files
4. **Authentication Middleware**: Locate auth middleware files and identify protected route patterns
5. **Database Models**: Find all database models/schemas and their files
6. **Import Issues**: Detect any broken or missing import statements from the file structure

Return your analysis as a JSON object matching this EXACT schema:

{
  "tech_stack": {
    "framework": "string (e.g., Next.js, Express, Django)",
    "language": "string (e.g., TypeScript, JavaScript, Python)",
    "dependencies": ["array", "of", "major", "dependencies"]
  },
  "api_routes": [
    {
      "method": "GET|POST|PUT|DELETE|PATCH",
      "path": "/api/example",
      "file": "path/to/file.ts",
      "line": 42
    }
  ],
  "frontend_pages": [
    {
      "path": "/dashboard",
      "file": "app/dashboard/page.tsx"
    }
  ],
  "auth_middleware": {
    "file": "middleware.ts",
    "protected_patterns": ["/dashboard/*", "/api/*"]
  },
  "database_models": [
    {
      "name": "User",
      "file": "lib/models/user.ts"
    }
  ],
  "import_issues": [
    {
      "file": "components/Button.tsx",
      "broken_import": "../utils/missing-file"
    }
  ]
}

IMPORTANT: 
- Return ONLY valid JSON, no markdown code blocks or explanations
- If a section has no data, use an empty array [] or null
- Be thorough but focus on the most important routes and models
- Line numbers can be approximate based on file structure`;

  try {
    // Use Groq with temperature 0.0 for deterministic output (Requirement 33.5)
    let text = await generateCompletion(prompt, 0.0);
    text = text.trim();

    // Clean up markdown code blocks if present
    if (text.startsWith('```json')) {
      text = text.slice(7);
    } else if (text.startsWith('```')) {
      text = text.slice(3);
    }
    if (text.endsWith('```')) {
      text = text.slice(0, -3);
    }
    text = text.trim();

    // Parse and validate JSON
    const codebaseContext = JSON.parse(text) as CodebaseContext;

    // Ensure all required fields exist with defaults
    return {
      tech_stack: codebaseContext.tech_stack || {
        framework: 'Unknown',
        language: 'Unknown',
        dependencies: [],
      },
      api_routes: codebaseContext.api_routes || [],
      frontend_pages: codebaseContext.frontend_pages || [],
      auth_middleware: codebaseContext.auth_middleware || null,
      database_models: codebaseContext.database_models || [],
      import_issues: codebaseContext.import_issues || [],
    };
  } catch (error) {
    console.error('Pass 1 analysis failed:', error);
    
    // Return minimal context on failure
    return {
      tech_stack: {
        framework: 'Unknown',
        language: 'Unknown',
        dependencies: [],
      },
      api_routes: [],
      frontend_pages: [],
      auth_middleware: null,
      database_models: [],
      import_issues: [],
    };
  }
}

/**
 * Filter files for Pass 2 analysis
 * Excludes: node_modules, .git, dist, build, *.lock files
 * 
 * Implements deterministic ordering (Requirement 33.4):
 * - Filters files by type and exclusion patterns
 * - Sorts alphabetically for consistent batch ordering
 */
function filterFilesForAnalysis(files: Array<{ path: string; type: string }>): string[] {
  const excludePatterns = [
    /node_modules/,
    /\.git/,
    /dist\//,
    /build\//,
    /\.lock$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
    /\.next/,
    /\.vercel/,
    /\.cache/,
    /coverage/,
    /\.env/,
    /\.DS_Store/,
  ];

  return files
    .filter(f => f.type === 'blob')
    .map(f => f.path)
    .filter(path => !excludePatterns.some(pattern => pattern.test(path)))
    .sort(); // Deterministic ordering (Requirement 33.4) - ensures consistent batch processing
}

/**
 * Batch files into groups for parallel processing
 */
function batchFiles(files: string[], batchSize: number = 10): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Analyze a single file for bugs and PRD compliance
 */
async function analyzeFile(
  runId: string,
  projectId: string,
  filePath: string,
  fileContent: string,
  codebaseContext: CodebaseContext,
  requirements: Requirement[],
  githubToken: string,
  project: Project
): Promise<Finding[]> {
  // Get related files from vector search
  let relatedFilesContext = '';
  try {
    const similarFiles = await searchSimilarFiles(projectId, fileContent, 3, filePath);
    if (similarFiles.length > 0) {
      relatedFilesContext = '\n\nRELATED FILES (from semantic search):\n' +
        similarFiles.map(f => {
          const truncated = f.content.length > 500 ? f.content.slice(0, 500) + '...' : f.content;
          return `\n=== ${f.file_path} (similarity: ${f.score.toFixed(2)}) ===\n${truncated}`;
        }).join('\n');
    }
  } catch (error) {
    console.error(`Failed to fetch related files for ${filePath}:`, error);
    // Continue without related files
  }

  // Build PRD requirements context
  const prdContext = requirements.length > 0
    ? '\n\nPRD REQUIREMENTS:\n' +
      requirements.map(req => 
        `- [${req.id}] ${req.feature_name}: ${req.description || ''}\n` +
        `  Endpoint: ${req.endpoint || 'N/A'}\n` +
        `  Expected: ${req.expected_behavior || 'N/A'}`
      ).join('\n\n')
    : '';

  // Build codebase context summary
  const contextSummary = `
CODEBASE CONTEXT:
- Framework: ${codebaseContext.tech_stack.framework}
- Language: ${codebaseContext.tech_stack.language}
- API Routes: ${codebaseContext.api_routes.length} routes defined
- Frontend Pages: ${codebaseContext.frontend_pages.length} pages
- Auth Middleware: ${codebaseContext.auth_middleware?.file || 'None'}
- Database Models: ${codebaseContext.database_models.map(m => m.name).join(', ') || 'None'}
`;

  const prompt = `You are a senior software engineer performing a comprehensive code review. Analyze this file for bugs and PRD compliance issues.

${contextSummary}

FILE: ${filePath}
\`\`\`
${fileContent}
\`\`\`
${relatedFilesContext}
${prdContext}

TASK: Identify ALL bugs and PRD compliance issues in this file. Focus on:

**BUG TYPES TO DETECT:**
1. Dead links (broken href/src attributes)
2. Broken imports (missing files, incorrect paths)
3. Broken event handlers (undefined functions, incorrect signatures)
4. Incorrect API routes (wrong paths, methods, missing endpoints)
5. Incorrect database queries (wrong table names, missing fields)
6. Missing input validation (unvalidated user input)
7. Broken auth middleware (unprotected routes, missing guards)
8. Unhandled async errors (missing try-catch, unhandled promises)
9. Wrong HTTP status codes (200 for errors, 500 for validation)

**PRD COMPLIANCE:**
- Check if implemented features match PRD requirements
- Verify endpoints match specified paths and methods
- Validate expected behaviors are implemented

Return your analysis as a JSON array of findings. Each finding must match this EXACT schema:

[
  {
    "category": "bug" | "prd_compliance",
    "severity": "critical" | "high" | "medium" | "low" | "info",
    "bug_type": "dead_link" | "broken_import" | "broken_event_handler" | "incorrect_api_route" | "incorrect_database_query" | "missing_input_validation" | "broken_auth_middleware" | "unhandled_async_error" | "wrong_http_status" | "prd_mismatch",
    "status": "fail",
    "file_path": "${filePath}",
    "line_start": <number>,
    "line_end": <number>,
    "code_snippet": "exact code with the issue",
    "explanation": "clear explanation of the problem",
    "requirement_id": "requirement UUID if PRD compliance issue, otherwise null",
    "fix_confidence": 0.85,
    "fix_original": "original buggy code",
    "fix_suggested": "corrected code",
    "fix_explanation": "explanation of the fix"
  }
]

IMPORTANT:
- Return ONLY valid JSON array, no markdown code blocks or explanations
- If no issues found, return empty array []
- Be thorough but avoid false positives
- Line numbers must be accurate
- Code snippets should be exact matches from the file
- All findings must have status "fail" (we only report issues, not passes)`;

  try {
    // Use Groq with temperature 0.0 for deterministic output (Requirement 33.5)
    let text = await generateCompletion(prompt, 0.0);
    text = text.trim();

    // Clean up markdown code blocks if present
    if (text.startsWith('```json')) {
      text = text.slice(7);
    } else if (text.startsWith('```')) {
      text = text.slice(3);
    }
    if (text.endsWith('```')) {
      text = text.slice(0, -3);
    }
    text = text.trim();

    // Parse JSON
    const findings = JSON.parse(text) as any[];

    // Map to Finding objects with proper types
    return findings.map(f => ({
      run_id: runId,
      requirement_id: f.requirement_id || null,
      pass_number: 2 as const,
      category: f.category as 'bug' | 'prd_compliance',
      severity: f.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
      bug_type: f.bug_type || null,
      status: 'fail' as const,
      file_path: f.file_path || filePath,
      line_start: f.line_start || null,
      line_end: f.line_end || null,
      code_snippet: f.code_snippet || null,
      explanation: f.explanation || null,
      fix_confidence: f.fix_confidence || null,
      fix_original: f.fix_original || null,
      fix_suggested: f.fix_suggested || null,
      fix_explanation: f.fix_explanation || null,
    }));
  } catch (error) {
    console.error(`Failed to analyze ${filePath}:`, error);
    
    // Return analysis error finding
    return [{
      run_id: runId,
      requirement_id: null,
      pass_number: 2 as const,
      category: 'bug' as const,
      severity: 'info' as const,
      bug_type: 'analysis_error',
      status: 'fail' as const,
      file_path: filePath,
      line_start: null,
      line_end: null,
      code_snippet: null,
      explanation: `Failed to analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      fix_confidence: null,
      fix_original: null,
      fix_suggested: null,
      fix_explanation: null,
    }];
  }
}

/**
 * Run Pass 2: Bug Detection and PRD Compliance
 * 
 * Processes files in batches with parallel analysis.
 * Implements partial failure handling with truncated content retry.
 */
async function runPass2(
  runId: string,
  project: Project,
  fileTree: { files: Array<{ path: string; type: string }> },
  githubToken: string,
  codebaseContext: CodebaseContext,
  requirements: Requirement[]
): Promise<Finding[]> {
  // Filter files for analysis
  const filesToAnalyze = filterFilesForAnalysis(fileTree.files);
  console.log(`[${runId}] Pass 2: Analyzing ${filesToAnalyze.length} files (filtered from ${fileTree.files.length})`);

  // Batch files
  const batches = batchFiles(filesToAnalyze, 10);
  console.log(`[${runId}] Pass 2: Processing ${batches.length} batches`);

  const allFindings: Finding[] = [];
  let processedFiles = 0;

  // Process batches sequentially (to avoid rate limits)
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`[${runId}] Pass 2: Processing batch ${batchIndex + 1}/${batches.length}`);

    // Update progress
    const progress = 30 + Math.floor((processedFiles / filesToAnalyze.length) * 30);
    await supabase
      .from('analysis_runs')
      .update({
        current_stage: `Analyzing files (${processedFiles}/${filesToAnalyze.length})`,
        current_progress: progress,
      })
      .eq('id', runId);

    // Process files in batch concurrently (10 at a time)
    const batchPromises = batch.map(async (filePath) => {
      try {
        // Fetch file content
        let fileContent = await fetchFileContent(
          project.repo_owner,
          project.repo_name,
          filePath,
          githubToken
        );

        // Analyze file
        const findings = await analyzeFile(
          runId,
          project.id,
          filePath,
          fileContent,
          codebaseContext,
          requirements,
          githubToken,
          project
        );

        return findings;
      } catch (error) {
        console.error(`[${runId}] Failed to analyze ${filePath}:`, error);

        // Retry with truncated content (first 200 lines)
        try {
          console.log(`[${runId}] Retrying ${filePath} with truncated content`);
          
          let fileContent = await fetchFileContent(
            project.repo_owner,
            project.repo_name,
            filePath,
            githubToken
          );

          // Truncate to first 200 lines
          const lines = fileContent.split('\n');
          if (lines.length > 200) {
            fileContent = lines.slice(0, 200).join('\n') + '\n... (truncated)';
          }

          const findings = await analyzeFile(
            runId,
            project.id,
            filePath,
            fileContent,
            codebaseContext,
            requirements,
            githubToken,
            project
          );

          return findings;
        } catch (retryError) {
          console.error(`[${runId}] Retry failed for ${filePath}:`, retryError);

          // Create analysis error finding
          return [{
            run_id: runId,
            requirement_id: null,
            pass_number: 2 as const,
            category: 'bug' as const,
            severity: 'info' as const,
            bug_type: 'analysis_error',
            status: 'fail' as const,
            file_path: filePath,
            line_start: null,
            line_end: null,
            code_snippet: null,
            explanation: `Failed to analyze file after retry: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`,
            fix_confidence: null,
            fix_original: null,
            fix_suggested: null,
            fix_explanation: null,
          }];
        }
      }
    });

    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Flatten findings
    const batchFindings = batchResults.flat();
    allFindings.push(...batchFindings);

    // Insert findings into database
    if (batchFindings.length > 0) {
      const { error } = await supabase
        .from('findings')
        .insert(batchFindings as any);

      if (error) {
        console.error(`[${runId}] Failed to insert findings:`, error);
      } else {
        console.log(`[${runId}] Inserted ${batchFindings.length} findings from batch ${batchIndex + 1}`);
      }
    }

    processedFiles += batch.length;
  }

  // Execute custom rules
  console.log(`[${runId}] Pass 2: Executing custom rules`);
  try {
    // Fetch custom rules for this project
    const { data: customRules, error: rulesError } = await supabase
      .from('custom_rules')
      .select('*')
      .eq('project_id', project.id)
      .eq('enabled', true);

    if (rulesError) {
      console.error(`[${runId}] Failed to fetch custom rules:`, rulesError);
    } else if (customRules && customRules.length > 0) {
      console.log(`[${runId}] Found ${customRules.length} enabled custom rules`);

      // Execute custom rules on all analyzed files
      const customRuleFindings: Finding[] = [];
      
      for (const filePath of filesToAnalyze) {
        try {
          // Fetch file content
          const fileContent = await fetchFileContent(
            project.repo_owner,
            project.repo_name,
            filePath,
            githubToken
          );

          // Execute custom rules
          const matches = await executeCustomRules(
            customRules as CustomRule[],
            filePath,
            fileContent
          );

          // Convert matches to findings
          const findings = convertMatchesToFindings(matches, runId, project.id);
          customRuleFindings.push(...findings);
        } catch (error) {
          console.error(`[${runId}] Failed to execute custom rules on ${filePath}:`, error);
          // Continue with other files
        }
      }

      // Insert custom rule findings
      if (customRuleFindings.length > 0) {
        const { error: insertError } = await supabase
          .from('findings')
          .insert(customRuleFindings as any);

        if (insertError) {
          console.error(`[${runId}] Failed to insert custom rule findings:`, insertError);
        } else {
          console.log(`[${runId}] Inserted ${customRuleFindings.length} custom rule findings`);
          allFindings.push(...customRuleFindings);
        }
      }
    }
  } catch (error) {
    console.error(`[${runId}] Error executing custom rules:`, error);
    // Don't fail the entire analysis if custom rules fail
  }

  console.log(`[${runId}] Pass 2 complete: ${allFindings.length} total findings`);
  return allFindings;
}

/**
 * Analyze files for performance anti-patterns (Part of Pass 2)
 */
async function analyzePerformanceIssues(
  runId: string,
  project: Project,
  fileTree: { files: Array<{ path: string; type: string }> },
  githubToken: string
): Promise<void> {
  console.log(`[${runId}] Analyzing performance anti-patterns`);

  // Filter files that are likely to have performance issues
  const targetFiles = fileTree.files
    .filter(f => f.type === 'blob')
    .filter(f => {
      const path = f.path.toLowerCase();
      return (
        path.endsWith('.ts') ||
        path.endsWith('.js') ||
        path.endsWith('.tsx') ||
        path.endsWith('.jsx') ||
        path.endsWith('.py')
      ) && !path.includes('node_modules') && !path.includes('.test.') && !path.includes('.spec.');
    })
    .slice(0, 100); // Limit to 100 files

  console.log(`[${runId}] Analyzing ${targetFiles.length} files for performance issues`);

  const allIssues = [];

  // Process files in batches
  const batchSize = 10;
  for (let i = 0; i < targetFiles.length; i += batchSize) {
    const batch = targetFiles.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (file) => {
      try {
        const content = await fetchFileContent(
          project.repo_owner,
          project.repo_name,
          file.path,
          githubToken
        );

        return analyzePerformance(file.path, content);
      } catch (error) {
        console.error(`[${runId}] Failed to analyze ${file.path}:`, error);
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    allIssues.push(...batchResults.flat());
  }

  // Convert to findings and insert
  if (allIssues.length > 0) {
    const findings = performanceIssuesToFindings(project.id, runId, allIssues);
    
    const { error } = await supabase
      .from('findings')
      .insert(findings as any);

    if (error) {
      console.error(`[${runId}] Failed to insert performance findings:`, error);
    } else {
      console.log(`[${runId}] Inserted ${findings.length} performance findings`);
    }
  }

  console.log(`[${runId}] Performance analysis complete: ${allIssues.length} issues found`);
}

/**
 * Run Pass 3: Security Audit
 * 
 * Analyzes the codebase for security vulnerabilities:
 * - SQL injection and NoSQL injection
 * - XSS vulnerabilities
 * - Hardcoded secrets and API keys
 * - Missing authentication guards
 * - CORS misconfiguration
 * - CSRF vulnerabilities
 * - IDOR vulnerabilities
 * - Outdated or vulnerable dependencies
 */
async function runPass3(
  runId: string,
  project: Project,
  fileTree: { files: Array<{ path: string; type: string }> },
  githubToken: string,
  codebaseContext: CodebaseContext
): Promise<Finding[]> {
  // Get security-sensitive files
  const securityFiles = fileTree.files
    .filter(f => f.type === 'blob')
    .filter(f => {
      const path = f.path.toLowerCase();
      return (
        path.includes('auth') ||
        path.includes('api') ||
        path.includes('route') ||
        path.includes('middleware') ||
        path.includes('db') ||
        path.includes('database') ||
        path.includes('query') ||
        path.includes('model') ||
        path.includes('.env') ||
        path.includes('config') ||
        path.includes('security')
      );
    })
    .slice(0, 50); // Limit to 50 most relevant files

  console.log(`[${runId}] Pass 3: Analyzing ${securityFiles.length} security-sensitive files`);

  // Fetch file contents
  const fileContents: Record<string, string> = {};
  for (const file of securityFiles) {
    try {
      const content = await fetchFileContent(
        project.repo_owner,
        project.repo_name,
        file.path,
        githubToken
      );
      fileContents[file.path] = content;
    } catch (error) {
      console.error(`[${runId}] Failed to fetch ${file.path}:`, error);
    }
  }

  // Build files context
  const filesContext = Object.entries(fileContents)
    .map(([path, content]) => {
      const truncated = content.length > 2000 ? content.slice(0, 2000) + '\n... (truncated)' : content;
      return `\n=== ${path} ===\n\`\`\`\n${truncated}\n\`\`\``;
    })
    .join('\n\n');

  // Build codebase context summary
  const contextSummary = `
CODEBASE CONTEXT:
- Framework: ${codebaseContext.tech_stack.framework}
- Language: ${codebaseContext.tech_stack.language}
- Dependencies: ${codebaseContext.tech_stack.dependencies.slice(0, 10).join(', ')}
- API Routes: ${codebaseContext.api_routes.length} routes
- Auth Middleware: ${codebaseContext.auth_middleware?.file || 'None detected'}
- Protected Patterns: ${codebaseContext.auth_middleware?.protected_patterns.join(', ') || 'None'}
- Database Models: ${codebaseContext.database_models.map(m => m.name).join(', ') || 'None'}
`;

  const prompt = `You are a senior security engineer performing a comprehensive security audit. Analyze this codebase for security vulnerabilities.

${contextSummary}

SECURITY-SENSITIVE FILES:
${filesContext}

TASK: Identify ALL security vulnerabilities in this codebase. Focus on:

**SECURITY VULNERABILITIES TO DETECT:**
1. **SQL Injection**: Unsanitized user input in SQL queries, string concatenation in queries
2. **NoSQL Injection**: Unsanitized input in MongoDB/NoSQL queries, object injection
3. **XSS (Cross-Site Scripting)**: Unescaped user input rendered in HTML, dangerouslySetInnerHTML
4. **Hardcoded Secrets**: API keys, passwords, tokens, private keys in source code
5. **Missing Auth Guards**: Protected routes without authentication middleware
6. **CORS Misconfiguration**: Overly permissive CORS policies (origin: '*')
7. **CSRF Vulnerabilities**: State-changing endpoints without CSRF protection
8. **IDOR (Insecure Direct Object Reference)**: Missing authorization checks on resource access
9. **Vulnerable Dependencies**: Outdated packages with known security issues

Return your analysis as a JSON array of findings. Each finding must match this EXACT schema:

[
  {
    "category": "security",
    "severity": "critical" | "high" | "medium" | "low",
    "bug_type": "sql_injection" | "nosql_injection" | "xss" | "hardcoded_secret" | "missing_auth_guard" | "cors_misconfiguration" | "csrf_vulnerability" | "idor" | "vulnerable_dependency",
    "status": "fail",
    "file_path": "path/to/file.ts",
    "line_start": <number>,
    "line_end": <number>,
    "code_snippet": "exact vulnerable code",
    "explanation": "clear explanation of the security risk and potential impact",
    "fix_confidence": 0.85,
    "fix_original": "original vulnerable code",
    "fix_suggested": "secure code with proper sanitization/validation",
    "fix_explanation": "explanation of how the fix addresses the vulnerability"
  }
]

IMPORTANT:
- Return ONLY valid JSON array, no markdown code blocks or explanations
- If no vulnerabilities found, return empty array []
- Be thorough - security issues are critical
- Prioritize high-severity vulnerabilities
- Line numbers must be accurate
- All findings must have status "fail"`;

  try {
    // Use Groq with temperature 0.0 for deterministic output (Requirement 33.5)
    let text = await generateCompletion(prompt, 0.0);
    text = text.trim();

    // Clean up markdown code blocks
    if (text.startsWith('```json')) {
      text = text.slice(7);
    } else if (text.startsWith('```')) {
      text = text.slice(3);
    }
    if (text.endsWith('```')) {
      text = text.slice(0, -3);
    }
    text = text.trim();

    // Parse JSON
    const findings = JSON.parse(text) as any[];

    // Map to Finding objects
    const securityFindings: Finding[] = findings.map(f => ({
      run_id: runId,
      requirement_id: null,
      pass_number: 3 as const,
      category: 'security' as const,
      severity: f.severity as FindingSeverity,
      bug_type: f.bug_type || null,
      status: 'fail' as const,
      file_path: f.file_path || null,
      line_start: f.line_start || null,
      line_end: f.line_end || null,
      code_snippet: f.code_snippet || null,
      explanation: f.explanation || null,
      fix_confidence: f.fix_confidence || null,
      fix_original: f.fix_original || null,
      fix_suggested: f.fix_suggested || null,
      fix_explanation: f.fix_explanation || null,
    }));

    // Insert findings into database
    if (securityFindings.length > 0) {
      const { error } = await supabase
        .from('findings')
        .insert(securityFindings as any);

      if (error) {
        console.error(`[${runId}] Failed to insert security findings:`, error);
      } else {
        console.log(`[${runId}] Inserted ${securityFindings.length} security findings`);
      }
    }

    return securityFindings;
  } catch (error) {
    console.error(`[${runId}] Pass 3 failed:`, error);
    return [];
  }
}

/**
 * Scan dependencies for vulnerabilities (Part of Pass 3)
 */
async function scanDependencies(
  runId: string,
  project: Project,
  fileTree: { files: Array<{ path: string; type: string }> },
  githubToken: string
): Promise<void> {
  console.log(`[${runId}] Scanning dependencies for vulnerabilities`);

  // Find dependency files
  const dependencyFiles = ['package.json', 'requirements.txt', 'go.mod', 'Gemfile.lock'];
  const foundFiles = fileTree.files.filter(f => 
    dependencyFiles.includes(f.path.toLowerCase())
  );

  if (foundFiles.length === 0) {
    console.log(`[${runId}] No dependency files found`);
    return;
  }

  // Scan each dependency file
  for (const file of foundFiles) {
    try {
      // Fetch file content
      const content = await fetchFileContent(
        project.repo_owner,
        project.repo_name,
        file.path,
        githubToken
      );

      // Scan for vulnerabilities
      const scanResults = await scanDependencyFile(file.path, content);

      // Create findings
      if (scanResults.length > 0) {
        await createDependencyFindings(
          project.id,
          runId,
          file.path,
          scanResults
        );
      }
    } catch (error) {
      console.error(`[${runId}] Failed to scan ${file.path}:`, error);
    }
  }

  console.log(`[${runId}] Dependency scanning complete`);
}

/**
 * Run Pass 4: Production Readiness Audit
 * 
 * Analyzes the codebase for production readiness issues:
 * - Missing caching strategy
 * - Missing rate limiting
 * - Missing health check endpoint
 * - Missing structured logging
 * - Missing graceful error handling
 * - Missing environment variable validation
 * - Missing database connection pooling
 * - Missing response compression
 * - Missing CI/CD pipeline
 * - Missing containerization (Dockerfile)
 */
async function runPass4(
  runId: string,
  codebaseContext: CodebaseContext
): Promise<Finding[]> {
  // Build codebase context summary
  const contextSummary = `
CODEBASE CONTEXT:
- Framework: ${codebaseContext.tech_stack.framework}
- Language: ${codebaseContext.tech_stack.language}
- Dependencies: ${codebaseContext.tech_stack.dependencies.join(', ')}
- API Routes: ${codebaseContext.api_routes.length} routes defined
  ${codebaseContext.api_routes.slice(0, 10).map(r => `  - ${r.method} ${r.path} (${r.file})`).join('\n  ')}
- Frontend Pages: ${codebaseContext.frontend_pages.length} pages
- Auth Middleware: ${codebaseContext.auth_middleware?.file || 'None detected'}
- Database Models: ${codebaseContext.database_models.map(m => `${m.name} (${m.file})`).join(', ') || 'None'}
`;

  const prompt = `You are a senior DevOps engineer performing a production readiness audit. Analyze this codebase for production deployment gaps.

${contextSummary}

TASK: Identify ALL production readiness issues in this codebase. Focus on:

**PRODUCTION READINESS ISSUES TO DETECT:**
1. **Missing Caching Strategy**: No caching layer (Redis, in-memory) for frequently accessed data
2. **Missing Rate Limiting**: Public API endpoints without rate limiting protection
3. **Missing Health Check Endpoint**: No /health or /api/health endpoint for monitoring
4. **Missing Structured Logging**: Console.log instead of structured logging (Winston, Pino, etc.)
5. **Missing Graceful Error Handling**: Unhandled promise rejections, missing global error handlers
6. **Missing Environment Variable Validation**: No validation of required env vars at startup
7. **Missing Database Connection Pooling**: Direct database connections without pooling
8. **Missing Response Compression**: No gzip/brotli compression middleware
9. **Missing CI/CD Pipeline**: No .github/workflows, .gitlab-ci.yml, or similar
10. **Missing Containerization**: No Dockerfile for containerized deployment

Return your analysis as a JSON array of findings. Each finding must match this EXACT schema:

[
  {
    "category": "production",
    "severity": "high" | "medium" | "low",
    "bug_type": "missing_caching" | "missing_rate_limiting" | "missing_health_check" | "missing_structured_logging" | "missing_error_handling" | "missing_env_validation" | "missing_connection_pooling" | "missing_compression" | "missing_ci_cd" | "missing_containerization",
    "status": "fail",
    "file_path": null,
    "line_start": null,
    "line_end": null,
    "code_snippet": null,
    "explanation": "clear explanation of what's missing and why it's important for production",
    "fix_confidence": 0.75,
    "fix_original": null,
    "fix_suggested": "example implementation or configuration",
    "fix_explanation": "explanation of how to implement the missing feature"
  }
]

IMPORTANT:
- Return ONLY valid JSON array, no markdown code blocks or explanations
- If no issues found, return empty array []
- Focus on critical production requirements
- Provide actionable recommendations
- All findings must have status "fail"
- file_path, line_start, line_end, code_snippet should be null for infrastructure issues`;

  try {
    // Use Groq with temperature 0.0 for deterministic output (Requirement 33.5)
    let text = await generateCompletion(prompt, 0.0);
    text = text.trim();

    // Clean up markdown code blocks
    if (text.startsWith('```json')) {
      text = text.slice(7);
    } else if (text.startsWith('```')) {
      text = text.slice(3);
    }
    if (text.endsWith('```')) {
      text = text.slice(0, -3);
    }
    text = text.trim();

    // Parse JSON
    const findings = JSON.parse(text) as any[];

    // Map to Finding objects
    const productionFindings: Finding[] = findings.map(f => ({
      run_id: runId,
      requirement_id: null,
      pass_number: 4 as const,
      category: 'production' as const,
      severity: f.severity as FindingSeverity,
      bug_type: f.bug_type || null,
      status: 'fail' as const,
      file_path: f.file_path || null,
      line_start: f.line_start || null,
      line_end: f.line_end || null,
      code_snippet: f.code_snippet || null,
      explanation: f.explanation || null,
      fix_confidence: f.fix_confidence || null,
      fix_original: f.fix_original || null,
      fix_suggested: f.fix_suggested || null,
      fix_explanation: f.fix_explanation || null,
    }));

    // Insert findings into database
    if (productionFindings.length > 0) {
      const { error } = await supabase
        .from('findings')
        .insert(productionFindings as any);

      if (error) {
        console.error(`[${runId}] Failed to insert production findings:`, error);
      } else {
        console.log(`[${runId}] Inserted ${productionFindings.length} production findings`);
      }
    }

    return productionFindings;
  } catch (error) {
    console.error(`[${runId}] Pass 4 failed:`, error);
    return [];
  }
}

/**
 * Calculate health score based on findings severity
 * 
 * Scoring:
 * - Critical: -20 points
 * - High: -10 points
 * - Medium: -5 points
 * - Low: -2 points
 * - Info: 0 points
 * 
 * Health score = 100 - (sum of penalties), capped at 0-100
 */
async function calculateHealthScore(runId: string): Promise<number> {
  const { data: findings } = await supabase
    .from('findings')
    .select('severity, status')
    .eq('run_id', runId)
    .eq('status', 'fail');

  if (!findings || findings.length === 0) {
    return 100;
  }

  const severityPenalties: Record<FindingSeverity, number> = {
    critical: 20,
    high: 10,
    medium: 5,
    low: 2,
    info: 0,
  };

  const totalPenalty = findings.reduce((sum, finding) => {
    return sum + (severityPenalties[finding.severity as FindingSeverity] || 0);
  }, 0);

  const healthScore = Math.max(0, Math.min(100, 100 - totalPenalty));
  
  return healthScore;
}

/**
 * Main analysis pipeline function
 * 
 * Orchestrates the complete 4-pass analysis with resumable steps.
 * Each step updates progress in the database for real-time SSE streaming.
 */
export const analysisRun = inngest.createFunction(
  {
    id: 'analysis-run',
    retries: 2,
  },
  { event: 'analysis/run' },
  async ({ event, step }) => {
    const { project_id, run_id, document_id } = event.data as AnalysisRunEvent;

    try {
      // Update status to running
      await supabase
        .from('analysis_runs')
        .update({ 
          status: 'running',
          current_stage: 'Starting analysis pipeline',
          current_progress: 0,
        })
        .eq('id', run_id);

      // Step 1: Fetch repository tree and key files
      const repoData = await step.run('fetch-repo-tree', async () => {
        console.log(`[${run_id}] Fetching repository data for project ${project_id}`);
        
        await supabase
          .from('analysis_runs')
          .update({
            current_stage: 'Fetching repository data',
            current_progress: 5,
          })
          .eq('id', run_id);

        const data = await fetchRepoData(project_id);
        
        console.log(`[${run_id}] Fetched ${data.fileTree.files.length} files`);
        
        return data;
      });

      // Step 2: Parse PRD (if provided)
      const requirements = await step.run('parse-prd', async () => {
        if (!document_id) {
          console.log(`[${run_id}] No PRD document provided, skipping`);
          return [];
        }

        console.log(`[${run_id}] Parsing PRD document ${document_id}`);
        
        await supabase
          .from('analysis_runs')
          .update({
            current_stage: 'Parsing PRD document',
            current_progress: 10,
          })
          .eq('id', run_id);

        // Fetch requirements from database
        const { data } = await supabase
          .from('requirements')
          .select('*')
          .eq('document_id', document_id);

        console.log(`[${run_id}] Found ${data?.length || 0} requirements`);
        
        return data || [];
      });

      // Step 3: Pass 1 - Understand codebase
      const codebaseContext = await step.run('pass1-understand', async () => {
        console.log(`[${run_id}] Starting Pass 1: Codebase Understanding`);
        
        await supabase
          .from('analysis_runs')
          .update({
            current_stage: 'Understanding codebase architecture',
            current_progress: 15,
          })
          .eq('id', run_id);

        const context = await runPass1(repoData.fileTree, repoData.keyFiles);

        console.log(`[${run_id}] Pass 1 complete:`, {
          framework: context.tech_stack.framework,
          language: context.tech_stack.language,
          api_routes: context.api_routes.length,
          frontend_pages: context.frontend_pages.length,
          database_models: context.database_models.length,
          import_issues: context.import_issues.length,
        });

        // Store codebase context
        await supabase
          .from('analysis_runs')
          .update({
            codebase_context: context as any,
            current_progress: 25,
            current_stage: 'Codebase understanding complete',
          })
          .eq('id', run_id);

        return context;
      });

      // Step 4: Pass 2 - Bug Detection and PRD Compliance
      const pass2Results = await step.run('pass2-bugs', async () => {
        console.log(`[${run_id}] Starting Pass 2: Bug Detection and PRD Compliance`);
        
        await supabase
          .from('analysis_runs')
          .update({
            current_stage: 'Analyzing files for bugs and PRD compliance',
            current_progress: 30,
          })
          .eq('id', run_id);

        const findings = await runPass2(
          run_id,
          repoData.project,
          repoData.fileTree,
          repoData.githubToken,
          codebaseContext,
          requirements
        );

        console.log(`[${run_id}] Pass 2 complete: ${findings.length} findings created`);

        // Analyze performance anti-patterns (part of Pass 2)
        await analyzePerformanceIssues(
          run_id,
          repoData.project,
          repoData.fileTree,
          repoData.githubToken
        );

        // Update progress to 60
        await supabase
          .from('analysis_runs')
          .update({
            current_stage: 'Bug detection and PRD compliance complete',
            current_progress: 60,
          })
          .eq('id', run_id);

        return findings;
      });

      // Step 5 & 6: Pass 3 (Security) and Pass 4 (Production) - Run in parallel
      const [pass3Results, pass4Results] = await step.run('pass3-and-pass4-parallel', async () => {
        console.log(`[${run_id}] Starting Pass 3 (Security) and Pass 4 (Production) in parallel`);
        
        await supabase
          .from('analysis_runs')
          .update({
            current_stage: 'Running security and production audits',
            current_progress: 65,
          })
          .eq('id', run_id);

        // Run both passes concurrently
        const [securityFindings, productionFindings] = await Promise.all([
          runPass3(run_id, repoData.project, repoData.fileTree, repoData.githubToken, codebaseContext),
          runPass4(run_id, codebaseContext),
        ]);

        console.log(`[${run_id}] Pass 3 complete: ${securityFindings.length} security findings`);
        console.log(`[${run_id}] Pass 4 complete: ${productionFindings.length} production findings`);

        // Scan dependencies for vulnerabilities (part of Pass 3)
        await scanDependencies(run_id, repoData.project, repoData.fileTree, repoData.githubToken);

        // Update progress to 80 after Pass 3
        await supabase
          .from('analysis_runs')
          .update({
            current_stage: 'Security audit complete',
            current_progress: 80,
          })
          .eq('id', run_id);

        // Update progress to 100 after Pass 4
        await supabase
          .from('analysis_runs')
          .update({
            current_stage: 'Production readiness audit complete',
            current_progress: 100,
          })
          .eq('id', run_id);

        return [securityFindings, productionFindings];
      });

      // Step 7: Calculate health score and finalize
      await step.run('finalize-analysis', async () => {
        const totalFindings = pass2Results.length + pass3Results.length + pass4Results.length;
        console.log(`[${run_id}] Finalizing analysis with ${totalFindings} total findings`);
        
        // Calculate health score
        const healthScore = await calculateHealthScore(run_id);
        
        console.log(`[${run_id}] Health score: ${healthScore}`);

        // Count findings by status
        const { data: allFindings } = await supabase
          .from('findings')
          .select('status')
          .eq('run_id', run_id);

        const failed = allFindings?.filter(f => f.status === 'fail').length || 0;
        const passed = allFindings?.filter(f => f.status === 'pass').length || 0;
        const total = allFindings?.length || 0;

        await supabase
          .from('analysis_runs')
          .update({
            status: 'complete',
            current_stage: 'Analysis complete',
            current_progress: 100,
            health_score: healthScore,
            total_tests: total,
            passed: passed,
            failed: failed,
            completed_at: new Date().toISOString(),
          })
          .eq('id', run_id);

        // Update project status and health score
        await supabase
          .from('projects')
          .update({ 
            status: 'complete',
            health_score: healthScore,
          })
          .eq('id', project_id);

        // Send analysis completion email
        const { data: projectData } = await supabase
          .from('projects')
          .select('name, user_id')
          .eq('id', project_id)
          .single();

        if (projectData) {
          await sendAnalysisCompleteEmail({
            userId: projectData.user_id,
            projectId: project_id,
            projectName: projectData.name,
            healthScore,
            totalTests: total,
            passed,
            failed,
          }).catch(error => {
            console.error('Failed to send analysis complete email:', error);
            // Don't fail the entire analysis if email fails
          });
        }
      });

      return {
        success: true,
        run_id,
        codebase_context: codebaseContext,
        findings_count: pass2Results.length + pass3Results.length + pass4Results.length,
        pass2_findings: pass2Results.length,
        pass3_findings: pass3Results.length,
        pass4_findings: pass4Results.length,
      };
    } catch (error) {
      console.error(`[${run_id}] Analysis pipeline failed:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update analysis run with error
      await supabase
        .from('analysis_runs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          current_stage: 'Analysis failed',
        })
        .eq('id', run_id);

      // Update project status
      await supabase
        .from('projects')
        .update({ status: 'error' })
        .eq('id', project_id);

      // Send analysis failure email
      const { data: projectData } = await supabase
        .from('projects')
        .select('name, user_id')
        .eq('id', project_id)
        .single();

      if (projectData) {
        await sendAnalysisFailedEmail({
          userId: projectData.user_id,
          projectId: project_id,
          projectName: projectData.name,
          errorMessage,
        }).catch(emailError => {
          console.error('Failed to send analysis failed email:', emailError);
          // Don't fail the entire analysis if email fails
        });
      }

      throw error;
    }
  }
);
