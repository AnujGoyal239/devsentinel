#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { analyzeCommand } from './commands/analyze.js';
import { waitCommand } from './commands/wait.js';
import { checkCommand } from './commands/check.js';
import type { CLIConfig } from './types.js';
import { ExitCode } from './types.js';

const program = new Command();

// CLI version and description
program
  .name('devsentinel')
  .description('DevSentinel CLI for CI/CD integration')
  .version('1.0.0');

// Global options
program
  .option('--api-key <key>', 'DevSentinel API key (or set DEVSENTINEL_API_KEY env var)')
  .option('--api-url <url>', 'DevSentinel API URL (or set DEVSENTINEL_API_URL env var)', 'https://devsentinel.com')
  .option('--verbose', 'Enable verbose output', false);

// Analyze command
program
  .command('analyze <project-id>')
  .description('Trigger analysis for a project')
  .action(async (projectId: string) => {
    const config = getConfig(program.opts());
    await analyzeCommand(projectId, config);
  });

// Wait command
program
  .command('wait <run-id>')
  .description('Wait for analysis to complete')
  .option('--timeout <seconds>', 'Maximum wait time in seconds', parseFloat)
  .action(async (runId: string, options: { timeout?: number }) => {
    const config = getConfig(program.opts());
    await waitCommand(runId, config, options.timeout);
  });

// Check command
program
  .command('check <project-id>')
  .description('Trigger analysis, wait for completion, and fail if health score is below threshold')
  .requiredOption('--threshold <score>', 'Minimum health score (0-100)', parseFloat)
  .option('--timeout <seconds>', 'Maximum wait time in seconds', parseFloat)
  .action(async (projectId: string, options: { threshold: number; timeout?: number }) => {
    // Validate threshold
    if (options.threshold < 0 || options.threshold > 100) {
      console.error(chalk.red('Error: Threshold must be between 0 and 100'));
      process.exit(ExitCode.ERROR);
    }

    const config = getConfig(program.opts());
    await checkCommand(projectId, options.threshold, config, options.timeout);
  });

// Parse arguments
program.parse();

/**
 * Get CLI configuration from options and environment variables
 */
function getConfig(opts: any): CLIConfig {
  // Get API key from option or environment variable
  const apiKey = opts.apiKey || process.env.DEVSENTINEL_API_KEY;
  if (!apiKey) {
    console.error(chalk.red('Error: API key is required'));
    console.error(chalk.yellow('\nProvide it via:'));
    console.error('  --api-key flag');
    console.error('  DEVSENTINEL_API_KEY environment variable');
    process.exit(ExitCode.ERROR);
  }

  // Validate API key format
  if (!apiKey.startsWith('ds_')) {
    console.error(chalk.red('Error: Invalid API key format'));
    console.error(chalk.yellow('API keys should start with "ds_"'));
    process.exit(ExitCode.ERROR);
  }

  // Get API URL from option or environment variable
  const apiUrl = opts.apiUrl || process.env.DEVSENTINEL_API_URL || 'https://devsentinel.com';

  return {
    apiKey,
    apiUrl,
    verbose: opts.verbose || false,
  };
}
