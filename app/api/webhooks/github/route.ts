/**
 * GitHub Webhook Endpoint
 * 
 * Handles GitHub webhook events (push, pull_request, release)
 * Verifies webhook signature and triggers analysis runs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { inngest } from '@/inngest/client';
import { logger } from '@/lib/monitoring/logger';

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

/**
 * Verify GitHub webhook signature
 */
function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    logger.error('GitHub webhook secret not configured');
    return false;
  }

  if (!signature) {
    logger.error('No signature provided in webhook request');
    return false;
  }

  // GitHub sends signature as "sha256=<hash>"
  const [algorithm, hash] = signature.split('=');
  
  if (algorithm !== 'sha256') {
    logger.error('Invalid signature algorithm', { algorithm });
    return false;
  }

  // Calculate expected signature
  const hmac = createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(payload);
  const expectedHash = hmac.digest('hex');

  // Constant-time comparison to prevent timing attacks
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const actualBuffer = Buffer.from(hash, 'hex');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * Find project by repository URL
 */
async function findProjectByRepo(owner: string, repo: string): Promise<string | null> {
  const repoUrl = `https://github.com/${owner}/${repo}`;
  
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('repo_owner', owner)
    .eq('repo_name', repo)
    .single();

  if (error || !data) {
    logger.info('No project found for repository', { owner, repo });
    return null;
  }

  return data.id;
}

/**
 * Trigger analysis run for a project
 */
async function triggerAnalysis(projectId: string, commitSha: string, eventType: string) {
  // Create analysis run
  const { data: run, error: runError } = await supabaseAdmin
    .from('analysis_runs')
    .insert({
      project_id: projectId,
      status: 'queued',
      current_stage: 'Queued',
      current_progress: 0,
      commit_sha: commitSha,
      triggered_by: `webhook:${eventType}`,
    })
    .select('id')
    .single();

  if (runError || !run) {
    logger.error('Failed to create analysis run', { projectId, error: runError?.message });
    throw new Error('Failed to create analysis run');
  }

  // Update project status
  await supabaseAdmin
    .from('projects')
    .update({ status: 'analysing' })
    .eq('id', projectId);

  // Enqueue Inngest event
  await inngest.send({
    name: 'analysis/run',
    data: {
      project_id: projectId,
      run_id: run.id,
    },
  });

  logger.info('Analysis triggered by webhook', {
    projectId,
    runId: run.id,
    commitSha,
    eventType,
  });

  return run.id;
}

/**
 * Handle GitHub webhook POST request
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256') || '';
    const event = request.headers.get('x-github-event') || '';
    const deliveryId = request.headers.get('x-github-delivery') || '';

    logger.info('Received GitHub webhook', {
      event,
      deliveryId,
      hasSignature: !!signature,
    });

    // Verify signature
    if (!verifySignature(body, signature)) {
      logger.error('Invalid webhook signature', {
        event,
        deliveryId,
      });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload
    const payload = JSON.parse(body);

    // Handle different event types
    let projectId: string | null = null;
    let commitSha: string | null = null;

    switch (event) {
      case 'push':
        // Handle push events
        const pushRepo = payload.repository;
        const pushOwner = pushRepo.owner.login || pushRepo.owner.name;
        const pushRepoName = pushRepo.name;
        commitSha = payload.after; // Latest commit SHA

        projectId = await findProjectByRepo(pushOwner, pushRepoName);
        
        if (projectId && commitSha) {
          await triggerAnalysis(projectId, commitSha, 'push');
        }
        break;

      case 'pull_request':
        // Handle pull request events (opened, synchronize)
        if (payload.action === 'opened' || payload.action === 'synchronize') {
          const prRepo = payload.repository;
          const prOwner = prRepo.owner.login || prRepo.owner.name;
          const prRepoName = prRepo.name;
          commitSha = payload.pull_request.head.sha;

          projectId = await findProjectByRepo(prOwner, prRepoName);
          
          if (projectId && commitSha) {
            await triggerAnalysis(projectId, commitSha, `pull_request:${payload.action}`);
          }
        }
        break;

      case 'release':
        // Handle release events (published)
        if (payload.action === 'published') {
          const releaseRepo = payload.repository;
          const releaseOwner = releaseRepo.owner.login || releaseRepo.owner.name;
          const releaseRepoName = releaseRepo.name;
          commitSha = payload.release.target_commitish;

          projectId = await findProjectByRepo(releaseOwner, releaseRepoName);
          
          if (projectId && commitSha) {
            await triggerAnalysis(projectId, commitSha, 'release:published');
          }
        }
        break;

      case 'ping':
        // Handle ping event (webhook setup verification)
        logger.info('GitHub webhook ping received', { deliveryId });
        return NextResponse.json({
          success: true,
          message: 'Webhook configured successfully',
        });

      default:
        logger.info('Unsupported webhook event', { event, deliveryId });
        return NextResponse.json({
          success: true,
          message: `Event ${event} not handled`,
        });
    }

    if (!projectId) {
      logger.info('No project found for webhook event', { event, deliveryId });
      return NextResponse.json({
        success: true,
        message: 'No project configured for this repository',
      });
    }

    return NextResponse.json({
      success: true,
      event,
      project_id: projectId,
      commit_sha: commitSha,
    });
  } catch (error) {
    logger.error('Error processing GitHub webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle GET request (for webhook setup verification)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'GitHub webhook endpoint is active',
    supported_events: ['push', 'pull_request', 'release'],
  });
}
