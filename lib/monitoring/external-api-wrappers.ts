/**
 * External API Wrappers with Logging
 * 
 * Provides monitored wrappers for:
 * - GitHub API calls
 * - AI model calls (Groq)
 * - E2B sandbox operations
 */

import { Octokit } from '@octokit/rest';
import { logGitHubApiCall, logAiModelCall, logE2bSandboxEvent, createLogger } from './logger';
import { captureException } from './sentry';

/**
 * Monitored GitHub API client
 */
export class MonitoredOctokit extends Octokit {
  constructor(options?: ConstructorParameters<typeof Octokit>[0]) {
    super(options);

    // Intercept all requests to add logging
    this.hook.wrap('request', async (request, options) => {
      const startTime = Date.now();
      const logger = createLogger();

      try {
        const response = await request(options);
        const durationMs = Date.now() - startTime;

        // Log the API call
        logGitHubApiCall(
          `${options.method} ${options.url}`,
          response.status,
          parseInt(response.headers['x-ratelimit-remaining'] || '0'),
          durationMs,
          logger.getCorrelationId()
        );

        return response;
      } catch (error) {
        const durationMs = Date.now() - startTime;
        
        logger.error('GitHub API call failed', {
          endpoint: `${options.method} ${options.url}`,
          duration_ms: durationMs,
          error: error instanceof Error ? error.message : String(error),
        });

        if (error instanceof Error) {
          captureException(error, {
            route: 'github-api',
            method: options.method,
          });
        }

        throw error;
      }
    });
  }
}

/**
 * Monitored AI model call wrapper
 */
export async function monitoredAiCall<T>(
  modelName: string,
  fn: () => Promise<T>,
  getTokenCount?: (result: T) => number
): Promise<T> {
  const startTime = Date.now();
  const logger = createLogger();

  try {
    const result = await fn();
    const latencyMs = Date.now() - startTime;
    const tokenCount = getTokenCount ? getTokenCount(result) : 0;

    logAiModelCall(
      modelName,
      tokenCount,
      latencyMs,
      true,
      logger.getCorrelationId()
    );

    return result;
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    logAiModelCall(
      modelName,
      0,
      latencyMs,
      false,
      logger.getCorrelationId()
    );

    logger.error('AI model call failed', {
      model_name: modelName,
      latency_ms: latencyMs,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error) {
      captureException(error, {
        route: `ai-model/${modelName}`,
        method: 'AI_CALL',
      });
    }

    throw error;
  }
}

/**
 * Monitored E2B sandbox operations
 */
export class MonitoredE2bSandbox {
  private sandboxId: string;
  private logger = createLogger();

  constructor(sandboxId: string) {
    this.sandboxId = sandboxId;
  }

  /**
   * Log sandbox creation
   */
  async logCreate(durationMs: number) {
    logE2bSandboxEvent(
      'create',
      this.sandboxId,
      durationMs,
      this.logger.getCorrelationId()
    );
  }

  /**
   * Log sandbox destruction
   */
  async logDestroy(durationMs: number) {
    logE2bSandboxEvent(
      'destroy',
      this.sandboxId,
      durationMs,
      this.logger.getCorrelationId()
    );
  }

  /**
   * Wrap sandbox operation with error tracking
   */
  async monitorOperation<T>(
    operationName: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      const durationMs = Date.now() - startTime;

      this.logger.info(`E2B sandbox operation: ${operationName}`, {
        sandbox_id: this.sandboxId,
        duration_ms: durationMs,
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      this.logger.error(`E2B sandbox operation failed: ${operationName}`, {
        sandbox_id: this.sandboxId,
        duration_ms: durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof Error) {
        captureException(error, {
          route: `e2b-sandbox/${operationName}`,
          method: 'E2B_OPERATION',
        });
      }

      throw error;
    }
  }
}
