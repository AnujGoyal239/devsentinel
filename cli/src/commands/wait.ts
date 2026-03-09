import chalk from 'chalk';
import ora from 'ora';
import { DevSentinelAPI } from '../api.js';
import type { CLIConfig } from '../types.js';
import { ExitCode } from '../types.js';

/**
 * Wait command - Wait for analysis to complete
 */
export async function waitCommand(
  runId: string,
  config: CLIConfig,
  timeout?: number
): Promise<void> {
  const api = new DevSentinelAPI(config);
  const spinner = ora('Waiting for analysis to complete...').start();

  let currentStage = '';
  let currentProgress = 0;
  let completed = false;
  let timeoutId: NodeJS.Timeout | null = null;

  // Set timeout if specified
  if (timeout && timeout > 0) {
    timeoutId = setTimeout(() => {
      if (!completed) {
        spinner.fail(chalk.red('Analysis timed out'));
        console.error(chalk.red(`\nError: Analysis did not complete within ${timeout} seconds`));
        process.exit(ExitCode.ERROR);
      }
    }, timeout * 1000);
  }

  try {
    await api.streamProgress(
      runId,
      // On progress
      (event) => {
        if (event.current_stage && event.current_stage !== currentStage) {
          currentStage = event.current_stage;
          spinner.text = `${currentStage} (${event.current_progress || 0}%)`;
        } else if (event.current_progress !== undefined && event.current_progress !== currentProgress) {
          currentProgress = event.current_progress;
          spinner.text = `${currentStage} (${currentProgress}%)`;
        }

        if (config.verbose && event.message) {
          spinner.info(chalk.gray(event.message));
          spinner.start();
        }
      },
      // On complete
      (event) => {
        completed = true;
        if (timeoutId) clearTimeout(timeoutId);

        if (event.status === 'complete') {
          spinner.succeed(chalk.green('Analysis completed successfully'));
          
          console.log(chalk.cyan('\nResults:'));
          console.log(`  Health Score: ${getHealthScoreDisplay(event.health_score)}`);
          console.log(`  Status: ${chalk.green('Complete')}`);
          
          if (config.verbose) {
            console.log(chalk.gray(`\nRun ID: ${runId}`));
          }
          
          process.exit(ExitCode.SUCCESS);
        } else if (event.status === 'failed') {
          spinner.fail(chalk.red('Analysis failed'));
          console.error(chalk.red(`\nError: ${event.error_message || 'Unknown error'}`));
          process.exit(ExitCode.ERROR);
        }
      },
      // On error
      (error) => {
        completed = true;
        if (timeoutId) clearTimeout(timeoutId);
        
        spinner.fail(chalk.red('Failed to stream progress'));
        console.error(chalk.red(`\nError: ${error.message}`));
        process.exit(ExitCode.ERROR);
      }
    );
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    spinner.fail(chalk.red('Failed to wait for analysis'));
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(ExitCode.ERROR);
  }
}

/**
 * Format health score with color
 */
function getHealthScoreDisplay(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return chalk.gray('N/A');
  }

  const scoreStr = `${score}/100`;
  
  if (score >= 80) {
    return chalk.green(scoreStr);
  } else if (score >= 50) {
    return chalk.yellow(scoreStr);
  } else {
    return chalk.red(scoreStr);
  }
}
