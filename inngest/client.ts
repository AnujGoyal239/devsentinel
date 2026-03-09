/**
 * Inngest Client
 * 
 * Singleton client for sending events and defining background functions.
 * Used for analysis pipeline and fix agent workflows.
 * 
 * Includes Sentry integration for error tracking.
 */

import { Inngest } from 'inngest';
import * as Sentry from '@sentry/nextjs';

/**
 * Inngest client instance with Sentry integration.
 * Use this to send events and define functions.
 * 
 * @example
 * // Send an event
 * await inngest.send({
 *   name: 'analysis/run',
 *   data: { project_id, run_id }
 * });
 * 
 * @example
 * // Define a function
 * export const analysisRun = inngest.createFunction(
 *   { id: 'analysis-run', retries: 2 },
 *   { event: 'analysis/run' },
 *   async ({ event, step }) => {
 *     // Function implementation
 *   }
 * );
 */
export const inngest = new Inngest({
  id: 'devsentinel',
  eventKey: process.env.INNGEST_EVENT_KEY,
  
  // Sentry integration for Inngest functions
  middleware: [
    {
      name: 'Sentry Error Tracking',
      init: () => {
        return {
          onFunctionRun: ({ fn, ctx }) => {
            return {
              transformOutput: (ctx) => {
                // Capture function errors to Sentry
                if (ctx.error) {
                  Sentry.captureException(ctx.error, {
                    tags: {
                      inngest_function: fn.id,
                      inngest_event: ctx.event.name,
                    },
                    contexts: {
                      inngest: {
                        function_id: fn.id,
                        event_name: ctx.event.name,
                        run_id: ctx.runId,
                        attempt: ctx.attempt,
                      },
                    },
                  });
                }
              },
            };
          },
        };
      },
    },
  ],
});
