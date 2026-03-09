/**
 * Data Cleanup Inngest Function
 * 
 * Scheduled job that runs daily to delete old data:
 * - analysis_runs older than 90 days
 * - findings older than 90 days
 * - fix_jobs older than 90 days
 * - Cascade deletes associated records
 */

import { inngest } from '../client';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logger } from '@/lib/monitoring/logger';

const RETENTION_DAYS = 90;

/**
 * Calculate cutoff date (90 days ago)
 */
function getCutoffDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - RETENTION_DAYS);
  return date.toISOString();
}

/**
 * Scheduled data cleanup function
 * Runs daily at 2 AM UTC
 */
export const dataCleanup = inngest.createFunction(
  {
    id: 'data-cleanup',
    name: 'Data Cleanup',
    retries: 2,
  },
  { cron: '0 2 * * *' }, // Daily at 2 AM UTC
  async ({ step }) => {
    const cutoffDate = getCutoffDate();
    
    logger.info('Starting data cleanup', { cutoffDate, retentionDays: RETENTION_DAYS });

    // ─────────────────────────────────────────────────────────────────────
    // Step 1: Delete old analysis runs
    // ─────────────────────────────────────────────────────────────────────
    const analysisRunsDeleted = await step.run('delete-old-analysis-runs', async () => {
      try {
        // First, get the IDs of analysis runs to delete
        const { data: oldRuns, error: fetchError } = await supabaseAdmin
          .from('analysis_runs')
          .select('id')
          .lt('created_at', cutoffDate);

        if (fetchError) {
          logger.error('Error fetching old analysis runs', { error: fetchError.message });
          throw fetchError;
        }

        if (!oldRuns || oldRuns.length === 0) {
          logger.info('No old analysis runs to delete');
          return 0;
        }

        const runIds = oldRuns.map(r => r.id);
        logger.info('Found old analysis runs to delete', { count: runIds.length });

        // Delete findings associated with these runs (cascade)
        const { error: findingsError } = await supabaseAdmin
          .from('findings')
          .delete()
          .in('run_id', runIds);

        if (findingsError) {
          logger.error('Error deleting findings for old runs', { error: findingsError.message });
          throw findingsError;
        }

        // Delete the analysis runs
        const { error: deleteError } = await supabaseAdmin
          .from('analysis_runs')
          .delete()
          .in('id', runIds);

        if (deleteError) {
          logger.error('Error deleting old analysis runs', { error: deleteError.message });
          throw deleteError;
        }

        logger.info('Deleted old analysis runs', { count: runIds.length });
        return runIds.length;
      } catch (error) {
        logger.error('Error in delete-old-analysis-runs step', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Step 2: Delete old fix jobs
    // ─────────────────────────────────────────────────────────────────────
    const fixJobsDeleted = await step.run('delete-old-fix-jobs', async () => {
      try {
        const { data: deleted, error } = await supabaseAdmin
          .from('fix_jobs')
          .delete()
          .lt('created_at', cutoffDate)
          .select('id');

        if (error) {
          logger.error('Error deleting old fix jobs', { error: error.message });
          throw error;
        }

        const count = deleted?.length || 0;
        logger.info('Deleted old fix jobs', { count });
        return count;
      } catch (error) {
        logger.error('Error in delete-old-fix-jobs step', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Step 3: Delete orphaned findings (not associated with any run)
    // ─────────────────────────────────────────────────────────────────────
    const orphanedFindingsDeleted = await step.run('delete-orphaned-findings', async () => {
      try {
        // Find findings older than 90 days that don't have a valid run_id
        const { data: deleted, error } = await supabaseAdmin
          .from('findings')
          .delete()
          .lt('created_at', cutoffDate)
          .is('run_id', null)
          .select('id');

        if (error) {
          logger.error('Error deleting orphaned findings', { error: error.message });
          throw error;
        }

        const count = deleted?.length || 0;
        if (count > 0) {
          logger.info('Deleted orphaned findings', { count });
        }
        return count;
      } catch (error) {
        logger.error('Error in delete-orphaned-findings step', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Step 4: Delete old documents (PRDs older than 90 days)
    // ─────────────────────────────────────────────────────────────────────
    const documentsDeleted = await step.run('delete-old-documents', async () => {
      try {
        // First, delete associated requirements
        const { data: oldDocs, error: fetchError } = await supabaseAdmin
          .from('documents')
          .select('id')
          .lt('created_at', cutoffDate);

        if (fetchError) {
          logger.error('Error fetching old documents', { error: fetchError.message });
          throw fetchError;
        }

        if (!oldDocs || oldDocs.length === 0) {
          logger.info('No old documents to delete');
          return 0;
        }

        const docIds = oldDocs.map(d => d.id);

        // Delete requirements associated with these documents
        const { error: reqError } = await supabaseAdmin
          .from('requirements')
          .delete()
          .in('document_id', docIds);

        if (reqError) {
          logger.error('Error deleting requirements for old documents', { error: reqError.message });
          throw reqError;
        }

        // Delete the documents
        const { error: deleteError } = await supabaseAdmin
          .from('documents')
          .delete()
          .in('id', docIds);

        if (deleteError) {
          logger.error('Error deleting old documents', { error: deleteError.message });
          throw deleteError;
        }

        logger.info('Deleted old documents', { count: docIds.length });
        return docIds.length;
      } catch (error) {
        logger.error('Error in delete-old-documents step', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    });

    logger.info('Data cleanup completed', {
      analysisRunsDeleted,
      fixJobsDeleted,
      orphanedFindingsDeleted,
      documentsDeleted,
      totalDeleted: analysisRunsDeleted + fixJobsDeleted + orphanedFindingsDeleted + documentsDeleted,
    });

    return {
      success: true,
      cutoffDate,
      analysisRunsDeleted,
      fixJobsDeleted,
      orphanedFindingsDeleted,
      documentsDeleted,
    };
  }
);
