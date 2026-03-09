/**
 * Analysis Trigger Endpoint
 * 
 * POST /api/projects/:id/analyse
 * 
 * Triggers the 4-pass AI analysis pipeline for a project.
 * Returns immediately with run_id while analysis runs in background.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { supabase } from '@/lib/supabase/server';
import { inngest } from '@/inngest/client';
import { createApiResponse, ApiErrors, createLogger } from '@/lib/monitoring/api-wrapper';
import { handleDatabaseError } from '@/lib/supabase/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const logger = createLogger();
  const correlationId = logger.getCorrelationId();

  try {
    // Authenticate user
    const session = await getSession();
    if (!session?.user) {
      return ApiErrors.unauthorized(undefined, correlationId);
    }

    const projectId = params.id;
    const userId = session.user.sub;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const documentId = body.document_id;

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      logger.error('Project not found or access denied', { projectId, userId });
      const dbError = handleDatabaseError(projectError);
      
      if (dbError.code === 'NOT_FOUND') {
        return ApiErrors.notFound('Project not found', correlationId);
      }
      
      return ApiErrors.forbidden(
        'You do not have permission to analyze this project',
        correlationId
      );
    }

    // Check if there's already an in-progress analysis run for this project (Requirement 33.2, 5.9)
    // Support concurrent analysis: queue new runs when one is already in progress
    const { data: existingRuns } = await supabase
      .from('analysis_runs')
      .select('id, status')
      .eq('project_id', projectId)
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
      .limit(1);

    // If there's an in-progress run, create a new queued run (don't block)
    // This allows multiple concurrent analysis runs for the same project (Requirement 5.9, 33.2)
    if (existingRuns && existingRuns.length > 0) {
      const existingRun = existingRuns[0];
      logger.info('Analysis already in progress, creating new queued run', {
        projectId,
        existingRunId: existingRun.id,
        existingStatus: existingRun.status,
      });
    }

    // Create analysis_runs record (always create a new one, even if one is in progress)
    const { data: analysisRun, error: runError } = await supabase
      .from('analysis_runs')
      .insert({
        project_id: projectId,
        status: 'queued',
        current_progress: 0,
        current_stage: 'Queued',
        total_tests: 0,
        passed: 0,
        failed: 0,
      })
      .select()
      .single();

    if (runError || !analysisRun) {
      logger.error('Failed to create analysis run', { error: runError?.message });
      const dbError = handleDatabaseError(runError);
      
      if (dbError.isConnectionError) {
        return ApiErrors.internalError(correlationId);
      }
      
      return ApiErrors.internalError(correlationId);
    }

    // Update project status
    await supabase
      .from('projects')
      .update({ status: 'analysing' })
      .eq('id', projectId);

    // Enqueue Inngest event
    try {
      await inngest.send({
        name: 'analysis/run',
        data: {
          project_id: projectId,
          run_id: analysisRun.id,
          document_id: documentId,
        },
      });
    } catch (inngestError) {
      logger.error('Failed to enqueue analysis job', {
        error: inngestError instanceof Error ? inngestError.message : String(inngestError),
      });
      
      // Clean up the analysis run
      await supabase
        .from('analysis_runs')
        .update({ status: 'failed', error_message: 'Failed to enqueue analysis job' })
        .eq('id', analysisRun.id);
      
      return ApiErrors.internalError(correlationId);
    }

    // Return run_id immediately (201 Created)
    // Include message if another run is in progress
    const message = existingRuns && existingRuns.length > 0
      ? 'Analysis pipeline queued (another analysis is in progress)'
      : 'Analysis pipeline started';

    return createApiResponse(
      {
        run_id: analysisRun.id,
        status: 'queued',
        message,
        queued: existingRuns && existingRuns.length > 0,
      },
      201,
      correlationId
    );
  } catch (error) {
    logger.error('Analysis trigger error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return ApiErrors.internalError(correlationId);
  }
}
