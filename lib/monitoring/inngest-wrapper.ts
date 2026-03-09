/**
 * Inngest Function Wrapper with Error Tracking and Logging
 * 
 * Wraps Inngest functions to automatically:
 * - Log job start/complete/failure
 * - Capture step failures to Sentry
 * - Track execution time
 * - Include correlation IDs
 */

import { captureException } from './sentry';
import {
  logInngestJobStart,
  logInngestJobComplete,
  logInngestJobFailure,
  createLogger,
} from './logger';

/**
 * Wrap an Inngest function handler with monitoring
 */
export function withInngestMonitoring<TEvent, TResult>(
  handler: (event: TEvent, step: any) => Promise<TResult>
): (event: TEvent, step: any) => Promise<TResult> {
  return async (event: TEvent, step: any) => {
    const startTime = Date.now();
    const logger = createLogger();
    const correlationId = logger.getCorrelationId();

    // Extract event info
    const eventData = event as any;
    const jobId = eventData.id || 'unknown';
    const eventType = eventData.name || 'unknown';

    // Log job start
    logInngestJobStart(jobId, eventType, eventData.data || {}, correlationId);

    try {
      // Execute the handler
      const result = await handler(event, step);

      // Log job completion
      const durationMs = Date.now() - startTime;
      logInngestJobComplete(
        jobId,
        'success',
        durationMs,
        { result: 'completed' },
        correlationId
      );

      return result;
    } catch (error) {
      // Log job failure
      const durationMs = Date.now() - startTime;
      
      if (error instanceof Error) {
        logInngestJobFailure(jobId, error, error.stack, correlationId);

        // Capture to Sentry
        captureException(error, {
          route: `inngest/${eventType}`,
          method: 'INNGEST',
          statusCode: 500,
        });
      }

      // Re-throw to let Inngest handle retries
      throw error;
    }
  };
}

/**
 * Wrap an Inngest step with error tracking
 */
export async function monitoredStep<T>(
  step: any,
  stepName: string,
  fn: () => Promise<T>
): Promise<T> {
  const logger = createLogger();
  const startTime = Date.now();

  try {
    logger.info(`Step started: ${stepName}`);
    const result = await step.run(stepName, fn);
    const durationMs = Date.now() - startTime;
    logger.info(`Step completed: ${stepName}`, { duration_ms: durationMs });
    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error(`Step failed: ${stepName}`, {
      duration_ms: durationMs,
      error: error instanceof Error ? error.message : String(error),
    });

    // Capture to Sentry
    if (error instanceof Error) {
      captureException(error, {
        route: `inngest/step/${stepName}`,
        method: 'INNGEST_STEP',
        statusCode: 500,
      });
    }

    throw error;
  }
}
