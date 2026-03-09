/**
 * Inngest Webhook Endpoint
 * 
 * Serves Inngest functions for webhook integration.
 * This endpoint is called by Inngest to execute background functions.
 */

import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { analysisRun } from '@/inngest/functions/analysis';
import { fixRun } from '@/inngest/functions/fix';
import { dataCleanup } from '@/inngest/functions/cleanup';
import { userDeletion } from '@/inngest/functions/user-deletion';

/**
 * Export all Inngest functions here
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    analysisRun,
    fixRun,
    dataCleanup,
    userDeletion,
  ],
});
