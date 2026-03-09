/**
 * User Deletion Inngest Function
 * 
 * Processes user account deletion after 30-day grace period
 * Deletes all user data including:
 * - User profile
 * - Projects
 * - Documents and requirements
 * - Analysis runs and findings
 * - Fix jobs
 * - Qdrant vector collections
 */

import { inngest } from '../client';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logger } from '@/lib/monitoring/logger';
import { qdrantClient } from '@/lib/vector/qdrant';

interface UserDeletionEvent {
  user_id: string;
  scheduled_at: string;
}

/**
 * User deletion function
 * Triggered 30 days after deletion request
 */
export const userDeletion = inngest.createFunction(
  {
    id: 'user-deletion',
    name: 'User Deletion',
    retries: 2,
  },
  { event: 'user/delete' },
  async ({ event, step }) => {
    const { user_id, scheduled_at } = event.data as UserDeletionEvent;

    logger.info('Processing user deletion', { userId: user_id, scheduledAt: scheduled_at });

    // ─────────────────────────────────────────────────────────────────────
    // Step 1: Verify deletion is still scheduled
    // ─────────────────────────────────────────────────────────────────────
    const shouldDelete = await step.run('verify-deletion-scheduled', async () => {
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('deletion_scheduled_at')
        .eq('id', user_id)
        .single();

      if (error || !user) {
        logger.error('User not found for deletion', { userId: user_id });
        return false;
      }

      // Check if deletion was cancelled
      if (!user.deletion_scheduled_at) {
        logger.info('User deletion was cancelled', { userId: user_id });
        return false;
      }

      // Check if scheduled date has passed
      const scheduledDate = new Date(user.deletion_scheduled_at);
      const now = new Date();
      
      if (now < scheduledDate) {
        logger.info('Deletion date not yet reached', {
          userId: user_id,
          scheduledDate: scheduledDate.toISOString(),
          now: now.toISOString(),
        });
        return false;
      }

      return true;
    });

    if (!shouldDelete) {
      logger.info('Skipping user deletion', { userId: user_id });
      return { success: true, deleted: false, reason: 'Deletion cancelled or not yet due' };
    }

    // ─────────────────────────────────────────────────────────────────────
    // Step 2: Get all user projects for Qdrant cleanup
    // ─────────────────────────────────────────────────────────────────────
    const projectIds = await step.run('get-user-projects', async () => {
      const { data: projects, error } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('user_id', user_id);

      if (error) {
        logger.error('Error fetching user projects', { userId: user_id, error: error.message });
        throw error;
      }

      return projects?.map(p => p.id) || [];
    });

    // ─────────────────────────────────────────────────────────────────────
    // Step 3: Delete Qdrant collections for user projects
    // ─────────────────────────────────────────────────────────────────────
    await step.run('delete-qdrant-collections', async () => {
      for (const projectId of projectIds) {
        try {
          await qdrantClient.deleteCollection(projectId);
          logger.info('Deleted Qdrant collection', { projectId });
        } catch (error) {
          logger.error('Error deleting Qdrant collection', {
            projectId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Continue with other collections even if one fails
        }
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Step 4: Delete fix jobs
    // ─────────────────────────────────────────────────────────────────────
    await step.run('delete-fix-jobs', async () => {
      // Get all findings for user's projects
      const { data: findings } = await supabaseAdmin
        .from('findings')
        .select('id')
        .in('run_id',
          supabaseAdmin
            .from('analysis_runs')
            .select('id')
            .in('project_id', projectIds)
        );

      if (findings && findings.length > 0) {
        const findingIds = findings.map(f => f.id);
        
        const { error } = await supabaseAdmin
          .from('fix_jobs')
          .delete()
          .in('finding_id', findingIds);

        if (error) {
          logger.error('Error deleting fix jobs', { userId: user_id, error: error.message });
          throw error;
        }

        logger.info('Deleted fix jobs', { userId: user_id, count: findings.length });
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Step 5: Delete findings
    // ─────────────────────────────────────────────────────────────────────
    await step.run('delete-findings', async () => {
      const { data: runs } = await supabaseAdmin
        .from('analysis_runs')
        .select('id')
        .in('project_id', projectIds);

      if (runs && runs.length > 0) {
        const runIds = runs.map(r => r.id);
        
        const { error } = await supabaseAdmin
          .from('findings')
          .delete()
          .in('run_id', runIds);

        if (error) {
          logger.error('Error deleting findings', { userId: user_id, error: error.message });
          throw error;
        }

        logger.info('Deleted findings', { userId: user_id });
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // Step 6: Delete analysis runs
    // ─────────────────────────────────────────────────────────────────────
    await step.run('delete-analysis-runs', async () => {
      const { error } = await supabaseAdmin
        .from('analysis_runs')
        .delete()
        .in('project_id', projectIds);

      if (error) {
        logger.error('Error deleting analysis runs', { userId: user_id, error: error.message });
        throw error;
      }

      logger.info('Deleted analysis runs', { userId: user_id });
    });

    // ─────────────────────────────────────────────────────────────────────
    // Step 7: Delete requirements
    // ─────────────────────────────────────────────────────────────────────
    await step.run('delete-requirements', async () => {
      const { error } = await supabaseAdmin
        .from('requirements')
        .delete()
        .eq('user_id', user_id);

      if (error) {
        logger.error('Error deleting requirements', { userId: user_id, error: error.message });
        throw error;
      }

      logger.info('Deleted requirements', { userId: user_id });
    });

    // ─────────────────────────────────────────────────────────────────────
    // Step 8: Delete documents
    // ─────────────────────────────────────────────────────────────────────
    await step.run('delete-documents', async () => {
      const { error } = await supabaseAdmin
        .from('documents')
        .delete()
        .eq('user_id', user_id);

      if (error) {
        logger.error('Error deleting documents', { userId: user_id, error: error.message });
        throw error;
      }

      logger.info('Deleted documents', { userId: user_id });
    });

    // ─────────────────────────────────────────────────────────────────────
    // Step 9: Delete projects
    // ─────────────────────────────────────────────────────────────────────
    await step.run('delete-projects', async () => {
      const { error } = await supabaseAdmin
        .from('projects')
        .delete()
        .eq('user_id', user_id);

      if (error) {
        logger.error('Error deleting projects', { userId: user_id, error: error.message });
        throw error;
      }

      logger.info('Deleted projects', { userId: user_id, count: projectIds.length });
    });

    // ─────────────────────────────────────────────────────────────────────
    // Step 10: Delete user profile
    // ─────────────────────────────────────────────────────────────────────
    await step.run('delete-user-profile', async () => {
      const { error } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', user_id);

      if (error) {
        logger.error('Error deleting user profile', { userId: user_id, error: error.message });
        throw error;
      }

      logger.info('Deleted user profile', { userId: user_id });
    });

    logger.info('User deletion completed', { userId: user_id });

    return {
      success: true,
      deleted: true,
      user_id,
      projects_deleted: projectIds.length,
    };
  }
);
