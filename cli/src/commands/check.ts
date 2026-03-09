import chalk from 'chalk';
import ora from 'ora';
import { DevSentinelAPI } from '../api.js';
import type { CLIConfig } from '../types.js';
import { ExitCode } from '../types.js';

/**
 * Check command - Trigger analysis, wait for completion, and fail if below threshold
 */
export async function checkCommand(
  projectId: string,
  threshold: number,
  config: CLIConfig,
  timeout?: number
): Promise<void> {
  const api = new DevSentinelAPI(config);
  let spinner = ora('Triggering analysis...').start();

  let currentStage = '';
  let currentProgress = 0;
  let completed = false;
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    // Trigger analysis
    const response = await api.triggerAnalysis(projectId);
    const runId = response.data.id;

    spinner.succeed(chalk.green('Analysis triggered'));
    
    if (config.verbose) {
      console.log(chalk.gray(`Run ID: ${runId}`));
    }

    // Wait for completion
    spinner = ora('Waiting for analysis to complete...').start();

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
          spinner.succeed(chalk.green('Analysis completed'));
          
          const healthScore = event.health_score ?? 0;
          
          console.log(chalk.cyan('\nResults:'));
          console.log(`  Health Score: ${getHealthScoreDisplay(healthScore)}`);
          console.log(`  Threshold: ${chalk.bold(threshold)}`);
          
          if (healthScore >= threshold) {
            console.log(chalk.green(`\n✓ Health score meets threshold (${healthScore} >= ${threshold})`));
            process.exit(ExitCode.SUCCESS);
          } else {
            console.log(chalk.red(`\n✗ Health score below threshold (${healthScore} < ${threshold})`));
            console.log(chalk.yellow('\nBuild failed due to low code quality.'));
            process.exit(ExitCode.THRESHOLD_NOT_MET);
          }
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
    spinner.fail(chalk.red('Failed to check analysis'));
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(ExitCode.ERROR);
  }
}

/**
 * Format health score with color
 */
function getHealthScoreDisplay(score: number): string {
  const scoreStr = `${score}/100`;
  
  if (score >= 80) {
    return chalk.green(scoreStr);
  } else if (score >= 50) {
    return chalk.yellow(scoreStr);
  } else {
    return chalk.red(scoreStr);
  }
}
