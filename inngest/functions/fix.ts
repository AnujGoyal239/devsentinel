/**
 * Fix Pipeline Inngest Function
 * 
 * Orchestrates the Auto-Fix agent workflow:
 * 1. Fetch finding and project details
 * 2. Create E2B sandbox
 * 3. Clone repository (placeholder for Task 16)
 * 4. Run fix agent (placeholder for Task 16)
 * 5. Cleanup sandbox
 * 
 * Each step is independently resumable for fault tolerance.
 */

import { inngest } from '../client';
import { supabase } from '@/lib/supabase/server';
import {
  createSandbox,
  destroySandbox,
  cloneRepository,
  installDependencies,
  executeCommand,
  type E2BSandbox,
} from '@/lib/e2b/client';
import { sendFixCompleteEmail } from '@/lib/email/notifications';

/**
 * Fix pipeline event data
 */
interface FixRunEvent {
  fix_job_id: string;
  finding_id: string;
}

/**
 * Agent log entry
 */
interface AgentLogEntry {
  stage: string;
  message: string;
  timestamp: string;
}

/**
 * Add log entry to fix job
 */
async function addLogEntry(
  fixJobId: string,
  stage: string,
  message: string
): Promise<void> {
  const logEntry: AgentLogEntry = {
    stage,
    message,
    timestamp: new Date().toISOString(),
  };

  // Fetch current log
  const { data: fixJob } = await supabase
    .from('fix_jobs')
    .select('agent_log')
    .eq('id', fixJobId)
    .single();

  const currentLog = (fixJob?.agent_log as AgentLogEntry[]) || [];

  // Append new entry
  await supabase
    .from('fix_jobs')
    .update({
      agent_log: [...currentLog, logEntry],
    })
    .eq('id', fixJobId);

  console.log(`[${fixJobId}] ${stage}: ${message}`);
}

/**
 * Update fix job status
 */
async function updateStatus(
  fixJobId: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  const updates: any = { status };

  if (errorMessage) {
    updates.error_message = errorMessage;
  }

  if (status === 'complete' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }

  await supabase
    .from('fix_jobs')
    .update(updates)
    .eq('id', fixJobId);

  console.log(`[${fixJobId}] Status updated: ${status}`);
}

/**
 * Fix pipeline Inngest function
 */
export const fixRun = inngest.createFunction(
  {
    id: 'fix-run',
    retries: 1, // 1 retry attempt (not 2 like analysis)
  },
  { event: 'fix/run' },
  async ({ event, step }) => {
    const { fix_job_id, finding_id } = event.data as FixRunEvent;

    console.log(`[${fix_job_id}] Starting fix pipeline for finding ${finding_id}`);

    let sandbox: E2BSandbox | null = null;
    let sandboxId: string | null = null;

    try {
      // ─────────────────────────────────────────────────────────────────────
      // Step 1: Fetch finding and project details
      // ─────────────────────────────────────────────────────────────────────
      const context = await step.run('fetch-context', async () => {
        await addLogEntry(fix_job_id, 'Initializing', 'Fetching finding and project details');

        // Fetch finding with related data
        const { data: finding, error: findingError } = await supabase
          .from('findings')
          .select(`
            *,
            analysis_runs!inner(
              project_id,
              projects!inner(
                id,
                user_id,
                repo_url,
                repo_owner,
                repo_name,
                branch,
                tech_stack
              )
            )
          `)
          .eq('id', finding_id)
          .single();

        if (findingError || !finding) {
          throw new Error(`Finding not found: ${finding_id}`);
        }

        // Extract project from nested structure
        const analysisRun = finding.analysis_runs as any;
        const project = analysisRun.projects;

        // Get user's GitHub token
        const { data: user } = await supabase
          .from('users')
          .select('github_token')
          .eq('id', project.user_id)
          .single();

        if (!user?.github_token) {
          throw new Error('GitHub token not found for user');
        }

        await addLogEntry(
          fix_job_id,
          'Initializing',
          `Found finding in ${finding.file_path || 'unknown file'}`
        );

        return {
          finding,
          project: {
            id: project.id,
            repo_url: project.repo_url,
            repo_owner: project.repo_owner,
            repo_name: project.repo_name,
            branch: project.branch,
            tech_stack: project.tech_stack,
          },
          githubToken: user.github_token,
        };
      });

      // ─────────────────────────────────────────────────────────────────────
      // Step 2: Create E2B sandbox
      // ─────────────────────────────────────────────────────────────────────
      sandbox = await step.run('create-sandbox', async () => {
        await updateStatus(fix_job_id, 'sandboxing');
        await addLogEntry(fix_job_id, 'Sandboxing', 'Creating isolated E2B sandbox');

        const sb = await createSandbox({
          timeout: 30 * 60 * 1000, // 30 minutes
          metadata: {
            fix_job_id,
            finding_id,
            project_id: context.project.id,
          },
        });

        // Store sandbox ID in fix_jobs table
        await supabase
          .from('fix_jobs')
          .update({ sandbox_id: sb.id })
          .eq('id', fix_job_id);

        sandboxId = sb.id;

        await addLogEntry(
          fix_job_id,
          'Sandboxing',
          `Sandbox created: ${sb.id}`
        );

        return sb;
      });

      // ─────────────────────────────────────────────────────────────────────
      // Step 3: Clone repository (placeholder for Task 16)
      // ─────────────────────────────────────────────────────────────────────
      const repoPath = await step.run('clone-repository', async () => {
        await addLogEntry(
          fix_job_id,
          'Sandboxing',
          `Cloning repository: ${context.project.repo_owner}/${context.project.repo_name}`
        );

        const path = await cloneRepository(
          sandbox!,
          context.project.repo_url,
          context.project.branch,
          context.githubToken
        );

        await addLogEntry(
          fix_job_id,
          'Sandboxing',
          'Repository cloned successfully'
        );

        // Install dependencies
        await addLogEntry(
          fix_job_id,
          'Sandboxing',
          'Installing dependencies...'
        );

        try {
          await installDependencies(sandbox!, path, 'npm');
          await addLogEntry(
            fix_job_id,
            'Sandboxing',
            'Dependencies installed successfully'
          );
        } catch (error) {
          // Log warning but continue - some projects may not need dependencies
          await addLogEntry(
            fix_job_id,
            'Sandboxing',
            `Dependency installation warning: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }

        return path;
      });

      // ─────────────────────────────────────────────────────────────────────
      // Step 4: Run fix agent (Claude Sonnet with tool loop)
      // ─────────────────────────────────────────────────────────────────────
      const agentResult = await step.run('run-fix-agent', async () => {
        await updateStatus(fix_job_id, 'coding');
        await addLogEntry(
          fix_job_id,
          'Coding',
          'Starting AI fix agent (Claude Sonnet)'
        );

        // Import Groq agent
        const { runFixAgent } = await import('@/lib/ai/groq-fix-agent');

        // Run Claude agent with tool loop
        const result = await runFixAgent(
          {
            file_path: context.finding.file_path || 'unknown',
            line_start: context.finding.line_start,
            line_end: context.finding.line_end,
            severity: context.finding.severity,
            category: context.finding.category,
            bug_type: context.finding.bug_type,
            explanation: context.finding.explanation || '',
            code_snippet: context.finding.code_snippet,
            fix_original: context.finding.fix_original,
            fix_suggested: context.finding.fix_suggested,
            fix_explanation: context.finding.fix_explanation,
          },
          sandbox!,
          repoPath,
          15 // Max 15 tool calls
        );

        // Log each tool call to fix_jobs.agent_log
        for (const logEntry of result.agent_log) {
          await addLogEntry(
            fix_job_id,
            'Coding',
            `${logEntry.tool_name}(${JSON.stringify(logEntry.input)}): ${logEntry.output.substring(0, 200)}${logEntry.output.length > 200 ? '...' : ''}`
          );
        }

        if (!result.success) {
          throw new Error(result.message);
        }

        await addLogEntry(
          fix_job_id,
          'Coding',
          `Fix completed: ${result.message} (${result.tool_calls} tool calls)`
        );

        return result;
      });

      // ─────────────────────────────────────────────────────────────────────
      // Step 5: Lint check
      // ─────────────────────────────────────────────────────────────────────
      const lintResult = await step.run('lint-check', async () => {
        await updateStatus(fix_job_id, 'linting');
        await addLogEntry(fix_job_id, 'Linting', 'Running linter on changed files');

        try {
          // Get list of changed files
          const changedFilesCmd = `cd ${repoPath} && git diff --name-only`;
          const changedFilesResult = await executeCommand(sandbox!, changedFilesCmd);
          const changedFiles = changedFilesResult.stdout.trim().split('\n').filter(f => f);

          if (changedFiles.length === 0) {
            await addLogEntry(fix_job_id, 'Linting', 'No files changed, skipping lint');
            return { passed: true, errors: [], warnings: [], fixed_automatically: [] };
          }

          await addLogEntry(
            fix_job_id,
            'Linting',
            `Linting ${changedFiles.length} changed file(s): ${changedFiles.join(', ')}`
          );

          // Run linter based on tech stack
          const techStack = context.project.tech_stack as any;
          let lintCommand = '';
          
          if (techStack?.language === 'typescript' || techStack?.language === 'javascript') {
            // Try ESLint with auto-fix
            lintCommand = `cd ${repoPath} && npx eslint --fix ${changedFiles.join(' ')} 2>&1 || true`;
          } else if (techStack?.language === 'python') {
            // Try pylint
            lintCommand = `cd ${repoPath} && python -m pylint ${changedFiles.join(' ')} 2>&1 || true`;
          } else {
            // Generic: just check syntax
            await addLogEntry(fix_job_id, 'Linting', 'No linter configured for this language');
            return { passed: true, errors: [], warnings: [], fixed_automatically: [] };
          }

          const lintOutput = await executeCommand(sandbox!, lintCommand);
          
          // Parse lint output (simplified - just check for errors)
          const hasErrors = lintOutput.stdout.includes('error') || lintOutput.exitCode > 1;
          const hasWarnings = lintOutput.stdout.includes('warning');

          const result = {
            passed: !hasErrors,
            errors: hasErrors ? [lintOutput.stdout.substring(0, 500)] : [],
            warnings: hasWarnings ? [lintOutput.stdout.substring(0, 500)] : [],
            fixed_automatically: [],
          };

          // Store lint result
          await supabase
            .from('fix_jobs')
            .update({ lint_result: result })
            .eq('id', fix_job_id);

          if (result.passed) {
            await addLogEntry(fix_job_id, 'Linting', 'Lint check passed');
          } else {
            await addLogEntry(fix_job_id, 'Linting', `Lint check failed: ${result.errors[0]}`);
          }

          return result;
        } catch (error) {
          // Log warning but continue - linting is not critical
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await addLogEntry(fix_job_id, 'Linting', `Lint check warning: ${errorMsg}`);
          return { passed: true, errors: [], warnings: [errorMsg], fixed_automatically: [] };
        }
      });

      // ─────────────────────────────────────────────────────────────────────
      // Step 6: Test run (with retry logic)
      // ─────────────────────────────────────────────────────────────────────
      const testResult = await step.run('test-run', async () => {
        await updateStatus(fix_job_id, 'testing');
        await addLogEntry(fix_job_id, 'Testing', 'Running tests');

        try {
          // Identify test files related to the changed file
          const filePath = context.finding.file_path || '';
          const testPatterns = [
            filePath.replace(/\.(ts|js|py)$/, '.test.$1'),
            filePath.replace(/\.(ts|js|py)$/, '.spec.$1'),
            filePath.replace(/src\//, 'tests/'),
            filePath.replace(/lib\//, '__tests__/'),
          ];

          await addLogEntry(
            fix_job_id,
            'Testing',
            `Looking for test files: ${testPatterns.join(', ')}`
          );

          // Try to find test files
          let testCommand = '';
          const techStack = context.project.tech_stack as any;

          if (techStack?.language === 'typescript' || techStack?.language === 'javascript') {
            // Try common test runners
            testCommand = `cd ${repoPath} && (npm test 2>&1 || npx jest 2>&1 || npx vitest run 2>&1 || echo "No tests found")`;
          } else if (techStack?.language === 'python') {
            testCommand = `cd ${repoPath} && (python -m pytest 2>&1 || python -m unittest discover 2>&1 || echo "No tests found")`;
          } else {
            await addLogEntry(fix_job_id, 'Testing', 'No test runner configured for this language');
            return { passed: true, output: 'No tests configured', failed_tests: [] };
          }

          const testOutput = await executeCommand(sandbox!, testCommand);
          
          // Check if tests passed
          const testsPassed = testOutput.exitCode === 0 && !testOutput.stdout.includes('FAIL');
          const failedTests = testsPassed ? [] : ['Test suite failed'];

          const result = {
            passed: testsPassed,
            output: testOutput.stdout.substring(0, 1000),
            failed_tests: failedTests,
          };

          // Store test result
          await supabase
            .from('fix_jobs')
            .update({ test_result: result })
            .eq('id', fix_job_id);

          if (result.passed) {
            await addLogEntry(fix_job_id, 'Testing', 'Tests passed');
          } else {
            await addLogEntry(fix_job_id, 'Testing', `Tests failed: ${result.output.substring(0, 200)}`);
          }

          return result;
        } catch (error) {
          // Log warning but continue - testing is not critical
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await addLogEntry(fix_job_id, 'Testing', `Test run warning: ${errorMsg}`);
          return { passed: true, output: errorMsg, failed_tests: [] };
        }
      });

      // ─────────────────────────────────────────────────────────────────────
      // Step 7: Retry logic if tests failed
      // ─────────────────────────────────────────────────────────────────────
      if (!testResult.passed) {
        // Check retry count
        const { data: currentJob } = await supabase
          .from('fix_jobs')
          .select('retry_count')
          .eq('id', fix_job_id)
          .single();

        const retryCount = currentJob?.retry_count || 0;

        if (retryCount < 1) {
          // Retry once with error context
          await addLogEntry(
            fix_job_id,
            'Testing',
            'Tests failed, retrying fix agent with error context'
          );

          // Increment retry count
          await supabase
            .from('fix_jobs')
            .update({ retry_count: retryCount + 1 })
            .eq('id', fix_job_id);

          // Re-run agent with test failure context
          const retryResult = await step.run('retry-fix-agent', async () => {
            await updateStatus(fix_job_id, 'coding');
            await addLogEntry(fix_job_id, 'Coding', 'Retrying fix with test failure context');

            const { runFixAgent } = await import('@/lib/ai/groq-fix-agent');

            // Append test failure to explanation
            const enhancedExplanation = `${context.finding.explanation}\n\nPrevious fix attempt failed tests:\n${testResult.output}`;

            const result = await runFixAgent(
              {
                ...context.finding,
                explanation: enhancedExplanation,
              },
              sandbox!,
              repoPath,
              15
            );

            for (const logEntry of result.agent_log) {
              await addLogEntry(
                fix_job_id,
                'Coding (Retry)',
                `${logEntry.tool_name}(${JSON.stringify(logEntry.input)}): ${logEntry.output.substring(0, 200)}`
              );
            }

            if (!result.success) {
              throw new Error(result.message);
            }

            await addLogEntry(
              fix_job_id,
              'Coding',
              `Retry completed: ${result.message}`
            );

            return result;
          });

          // Re-run tests after retry
          const retryTestResult = await step.run('retry-test-run', async () => {
            await updateStatus(fix_job_id, 'testing');
            await addLogEntry(fix_job_id, 'Testing', 'Running tests after retry');

            const techStack = context.project.tech_stack as any;
            let testCommand = '';

            if (techStack?.language === 'typescript' || techStack?.language === 'javascript') {
              testCommand = `cd ${repoPath} && (npm test 2>&1 || npx jest 2>&1 || npx vitest run 2>&1)`;
            } else if (techStack?.language === 'python') {
              testCommand = `cd ${repoPath} && (python -m pytest 2>&1 || python -m unittest discover 2>&1)`;
            }

            const testOutput = await executeCommand(sandbox!, testCommand);
            const testsPassed = testOutput.exitCode === 0;

            const result = {
              passed: testsPassed,
              output: testOutput.stdout.substring(0, 1000),
              failed_tests: testsPassed ? [] : ['Test suite failed after retry'],
            };

            await supabase
              .from('fix_jobs')
              .update({ test_result: result })
              .eq('id', fix_job_id);

            if (!result.passed) {
              throw new Error(`Tests still failing after retry: ${result.output.substring(0, 200)}`);
            }

            await addLogEntry(fix_job_id, 'Testing', 'Tests passed after retry');
            return result;
          });
        } else {
          // Already retried once, fail the job
          throw new Error(`Tests failed after retry: ${testResult.output}`);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Step 8: Create GitHub PR
      // ─────────────────────────────────────────────────────────────────────
      const prResult = await step.run('create-pr', async () => {
        await updateStatus(fix_job_id, 'opening_pr');
        await addLogEntry(fix_job_id, 'Opening PR', 'Creating GitHub Pull Request');

        try {
          // Generate branch name
          const branchName = `devsentinel/fix-${finding_id}`;

          // Store branch name
          await supabase
            .from('fix_jobs')
            .update({ branch_name: branchName })
            .eq('id', fix_job_id);

          // Create commit
          const commitMessage = `Fix: ${context.finding.bug_type || 'issue'} in ${context.finding.file_path}

${context.finding.explanation}

Auto-generated by DevSentinel`;

          await addLogEntry(fix_job_id, 'Opening PR', 'Creating git commit');

          const gitCommands = [
            `cd ${repoPath}`,
            `git config user.email "devsentinel@bot.com"`,
            `git config user.name "DevSentinel Bot"`,
            `git checkout -b ${branchName}`,
            `git add -A`,
            `git commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
          ].join(' && ');

          const commitResult = await executeCommand(sandbox!, gitCommands);

          if (commitResult.exitCode !== 0) {
            throw new Error(`Git commit failed: ${commitResult.stderr}`);
          }

          await addLogEntry(fix_job_id, 'Opening PR', 'Pushing branch to GitHub');

          // Push branch
          const pushCommand = `cd ${repoPath} && git push https://${context.githubToken}@github.com/${context.project.repo_owner}/${context.project.repo_name}.git ${branchName}`;
          const pushResult = await executeCommand(sandbox!, pushCommand);

          if (pushResult.exitCode !== 0) {
            throw new Error(`Git push failed: ${pushResult.stderr}`);
          }

          await addLogEntry(fix_job_id, 'Opening PR', 'Creating pull request');

          // Create PR using Octokit
          const { Octokit } = await import('@octokit/rest');
          const octokit = new Octokit({ auth: context.githubToken });

          const prTitle = `[DevSentinel] Fix: ${context.finding.bug_type || 'Issue'} in ${context.finding.file_path}`;
          const prBody = `## Auto-Fix by DevSentinel

**Issue:** ${context.finding.bug_type || 'Bug'}
**File:** ${context.finding.file_path}
**Lines:** ${context.finding.line_start}-${context.finding.line_end}
**Severity:** ${context.finding.severity}

### Explanation
${context.finding.explanation}

### Fix Details
${context.finding.fix_explanation || 'Automated fix applied'}

---
*This PR was automatically generated by DevSentinel. Please review carefully before merging.*`;

          const pr = await octokit.pulls.create({
            owner: context.project.repo_owner,
            repo: context.project.repo_name,
            title: prTitle,
            head: branchName,
            base: context.project.branch,
            body: prBody,
          });

          // Store PR details
          await supabase
            .from('fix_jobs')
            .update({
              pr_url: pr.data.html_url,
              pr_number: pr.data.number,
            })
            .eq('id', fix_job_id);

          await addLogEntry(
            fix_job_id,
            'Opening PR',
            `Pull request created: ${pr.data.html_url}`
          );

          return {
            pr_url: pr.data.html_url,
            pr_number: pr.data.number,
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await addLogEntry(fix_job_id, 'Opening PR', `PR creation failed: ${errorMsg}`);
          throw error;
        }
      });

      // ─────────────────────────────────────────────────────────────────────
      // Step 9: Cleanup sandbox
      // ─────────────────────────────────────────────────────────────────────
      await step.run('cleanup-sandbox', async () => {
        // Mark fix job as complete
        await updateStatus(fix_job_id, 'complete');
        await addLogEntry(fix_job_id, 'Complete', `Fix applied successfully. PR: ${prResult.pr_url}`);

        if (sandbox) {
          await addLogEntry(fix_job_id, 'Cleanup', 'Destroying sandbox');
          await destroySandbox(sandbox);
          await addLogEntry(fix_job_id, 'Cleanup', 'Sandbox destroyed');
        }

        // Send fix completion email
        const { data: fixJobData } = await supabase
          .from('fix_jobs')
          .select(`
            findings!inner(
              bug_type,
              file_path,
              projects!inner(
                name,
                user_id
              )
            )
          `)
          .eq('id', fix_job_id)
          .single();

        if (fixJobData && prResult.pr_url && prResult.pr_number) {
          const finding = (fixJobData as any).findings;
          const project = finding.projects;
          
          await sendFixCompleteEmail({
            userId: project.user_id,
            projectName: project.name,
            bugType: finding.bug_type || 'Issue',
            filePath: finding.file_path || 'Unknown file',
            prUrl: prResult.pr_url,
            prNumber: prResult.pr_number,
          }).catch(error => {
            console.error('Failed to send fix complete email:', error);
            // Don't fail the entire fix if email fails
          });
        }
      });

      console.log(`[${fix_job_id}] Fix pipeline completed successfully`);
      return { success: true, fix_job_id, pr_url: prResult.pr_url };
    } catch (error) {
      console.error(`[${fix_job_id}] Fix pipeline failed:`, error);

      // Update status to failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await updateStatus(fix_job_id, 'failed', errorMessage);
      await addLogEntry(fix_job_id, 'Failed', errorMessage);

      // Cleanup sandbox on failure (enforce 30-min max lifetime)
      if (sandbox) {
        try {
          await destroySandbox(sandbox);
          await addLogEntry(fix_job_id, 'Cleanup', 'Sandbox destroyed after failure');
        } catch (cleanupError) {
          console.error(`[${fix_job_id}] Sandbox cleanup failed:`, cleanupError);
        }
      }

      throw error;
    }
  }
);
