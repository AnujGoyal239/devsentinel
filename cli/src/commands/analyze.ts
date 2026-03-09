import chalk from 'chalk';
import ora from 'ora';
import { DevSentinelAPI } from '../api.js';
import type { CLIConfig } from '../types.js';
import { ExitCode } from '../types.js';

/**
 * Analyze command - Trigger analysis for a project
 */
export async function analyzeCommand(
  projectId: string,
  config: CLIConfig
): Promise<void> {
  const api = new DevSentinelAPI(config);
  const spinner = ora('Triggering analysis...').start();

  try {
    // Trigger analysis
    const response = await api.triggerAnalysis(projectId);
    const runId = response.data.id;

    spinner.succeed(chalk.green(`Analysis triggered successfully`));
    
    console.log(chalk.cyan('\nAnalysis Details:'));
    console.log(`  Run ID: ${chalk.bold(runId)}`);
    console.log(`  Project ID: ${chalk.bold(projectId)}`);
    console.log(`  Status: ${chalk.yellow(response.data.status)}`);
    
    if (config.verbose) {
      console.log(chalk.gray(`\nAPI URL: ${config.apiUrl}`));
      console.log(chalk.gray(`Created at: ${response.data.created_at}`));
    }

    console.log(chalk.cyan('\nTo wait for completion, run:'));
    console.log(chalk.bold(`  devsentinel wait ${runId}`));
    
    process.exit(ExitCode.SUCCESS);
  } catch (error) {
    spinner.fail(chalk.red('Failed to trigger analysis'));
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(ExitCode.ERROR);
  }
}
