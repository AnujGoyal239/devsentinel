/**
 * Report Sharing
 * 
 * Generates shareable links for analysis reports with:
 * - Unique tokens for security
 * - Expiration after 30 days
 * - Revocation capability
 * - Read-only access
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { logger } from '@/lib/monitoring/logger';
import { randomBytes } from 'crypto';

export interface ShareableLink {
  id: string;
  run_id: string;
  token: string;
  created_at: string;
  expires_at: string;
  revoked: boolean;
  access_count: number;
}

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Create a shareable link for an analysis run
 */
export async function createShareableLink(
  runId: string,
  userId: string
): Promise<ShareableLink | null> {
  try {
    // Verify user owns this run
    const { data: run, error: runError } = await supabaseAdmin
      .from('analysis_runs')
      .select('project_id')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      logger.error('Analysis run not found', { runId, error: runError?.message });
      return null;
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('user_id')
      .eq('id', run.project_id)
      .single();

    if (projectError || !project || project.user_id !== userId) {
      logger.error('Unauthorized access to project', {
        runId,
        userId,
        error: projectError?.message,
      });
      return null;
    }

    // Generate token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

    // Create share record
    const { data: share, error: shareError } = await supabaseAdmin
      .from('report_shares')
      .insert({
        run_id: runId,
        token,
        expires_at: expiresAt.toISOString(),
        revoked: false,
        access_count: 0,
      })
      .select()
      .single();

    if (shareError || !share) {
      logger.error('Failed to create shareable link', {
        runId,
        error: shareError?.message,
      });
      return null;
    }

    logger.info('Created shareable link', {
      runId,
      shareId: share.id,
      expiresAt: expiresAt.toISOString(),
    });

    return share;
  } catch (error) {
    logger.error('Error creating shareable link', {
      runId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Get shareable link by token
 */
export async function getShareableLink(token: string): Promise<ShareableLink | null> {
  try {
    const { data: share, error } = await supabaseAdmin
      .from('report_shares')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !share) {
      logger.warn('Shareable link not found', { token: token.substring(0, 8) });
      return null;
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(share.expires_at);

    if (now > expiresAt) {
      logger.warn('Shareable link expired', {
        shareId: share.id,
        expiresAt: share.expires_at,
      });
      return null;
    }

    // Check if revoked
    if (share.revoked) {
      logger.warn('Shareable link revoked', { shareId: share.id });
      return null;
    }

    // Increment access count
    await supabaseAdmin
      .from('report_shares')
      .update({ access_count: share.access_count + 1 })
      .eq('id', share.id);

    return share;
  } catch (error) {
    logger.error('Error getting shareable link', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Revoke a shareable link
 */
export async function revokeShareableLink(
  shareId: string,
  userId: string
): Promise<boolean> {
  try {
    // Verify user owns this share
    const { data: share, error: shareError } = await supabaseAdmin
      .from('report_shares')
      .select('run_id')
      .eq('id', shareId)
      .single();

    if (shareError || !share) {
      logger.error('Share not found', { shareId, error: shareError?.message });
      return false;
    }

    const { data: run, error: runError } = await supabaseAdmin
      .from('analysis_runs')
      .select('project_id')
      .eq('id', share.run_id)
      .single();

    if (runError || !run) {
      logger.error('Run not found', { runId: share.run_id, error: runError?.message });
      return false;
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('user_id')
      .eq('id', run.project_id)
      .single();

    if (projectError || !project || project.user_id !== userId) {
      logger.error('Unauthorized revoke attempt', {
        shareId,
        userId,
        error: projectError?.message,
      });
      return false;
    }

    // Revoke the share
    const { error: updateError } = await supabaseAdmin
      .from('report_shares')
      .update({ revoked: true })
      .eq('id', shareId);

    if (updateError) {
      logger.error('Failed to revoke share', {
        shareId,
        error: updateError.message,
      });
      return false;
    }

    logger.info('Revoked shareable link', { shareId });
    return true;
  } catch (error) {
    logger.error('Error revoking shareable link', {
      shareId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Get all shareable links for a run
 */
export async function getShareableLinksForRun(
  runId: string,
  userId: string
): Promise<ShareableLink[]> {
  try {
    // Verify user owns this run
    const { data: run, error: runError } = await supabaseAdmin
      .from('analysis_runs')
      .select('project_id')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      logger.error('Run not found', { runId, error: runError?.message });
      return [];
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('user_id')
      .eq('id', run.project_id)
      .single();

    if (projectError || !project || project.user_id !== userId) {
      logger.error('Unauthorized access', {
        runId,
        userId,
        error: projectError?.message,
      });
      return [];
    }

    // Get all shares for this run
    const { data: shares, error: sharesError } = await supabaseAdmin
      .from('report_shares')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: false });

    if (sharesError) {
      logger.error('Failed to fetch shares', {
        runId,
        error: sharesError.message,
      });
      return [];
    }

    return shares || [];
  } catch (error) {
    logger.error('Error getting shareable links', {
      runId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Clean up expired shares (should be run periodically)
 */
export async function cleanupExpiredShares(): Promise<number> {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('report_shares')
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (error) {
      logger.error('Failed to cleanup expired shares', { error: error.message });
      return 0;
    }

    const count = data?.length || 0;
    logger.info('Cleaned up expired shares', { count });
    return count;
  } catch (error) {
    logger.error('Error cleaning up expired shares', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}
