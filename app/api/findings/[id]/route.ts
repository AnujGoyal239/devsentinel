/**
 * Finding Update API Route
 * 
 * PATCH /api/findings/[id] - Update finding status and recalculate health score
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createApiResponse, ApiErrors, createLogger } from '@/lib/monitoring/api-wrapper';
import { handleDatabaseError } from '@/lib/supabase/errors';

/**
 * Calculate health score based on findings
 * @param runId - Analysis run ID
 * @returns Health score from 0 to 100
 */
async function calculateHealthScore(runId: string): Promise<number> {
  const { data: findings } = await supabase
    .from('findings')
    .select('severity, status')
    .eq('run_id', runId)
    .eq('status', 'fail');

  if (!findings || findings.length === 0) {
    return 100;
  }

  const severityPenalties: Record<string, number> = {
    critical: 20,
    high: 10,
    medium: 5,
    low: 2,
    info: 0,
  };

  const totalPenalty = findings.reduce((sum, finding) => {
    return sum + (severityPenalties[finding.severity] || 0);
  }, 0);

  const healthScore = Math.max(0, Math.min(100, 100 - totalPenalty));
  
  return healthScore;
}

/**
 * PATCH /api/findings/[id]
 * Update finding status and recalculate health score
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const logger = createLogger();
  const correlationId = logger.getCorrelationId();

  try {
    // Get authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return ApiErrors.unauthorized(undefined, correlationId);
    }

    const findingId = params.id;

    // Parse request body
    const body = await request.json();
    const { status } = body;

    // Validate status
    if (!status || !['pass', 'fail'].includes(status)) {
      return ApiErrors.badRequest(
        'Invalid status. Must be "pass" or "fail"',
        correlationId
      );
    }

    // Fetch the finding with its analysis run and project
    const { data: finding, error: findingError } = await supabase
      .from('findings')
      .select(`
        *,
        analysis_runs!inner (
          id,
          project_id,
          projects!inner (
            id,
            user_id
          )
        )
      `)
      .eq('id', findingId)
      .single();

    if (findingError) {
      logger.error('Error fetching finding', { error: findingError.message, findingId });
      const dbError = handleDatabaseError(findingError);
      
      if (dbError.code === 'NOT_FOUND') {
        return ApiErrors.notFound('Finding not found', correlationId);
      }
      
      if (dbError.isConnectionError) {
        return ApiErrors.internalError(correlationId);
      }
      
      return ApiErrors.internalError(correlationId);
    }

    // Check authorization - finding must belong to user's project
    const projectUserId = (finding.analysis_runs as any).projects.user_id;
    if (projectUserId !== user.id) {
      return ApiErrors.forbidden(
        'You do not have permission to update this finding',
        correlationId
      );
    }

    // Update finding status
    const { error: updateError } = await supabase
      .from('findings')
      .update({ status })
      .eq('id', findingId);

    if (updateError) {
      logger.error('Error updating finding', { error: updateError.message });
      return ApiErrors.internalError(correlationId);
    }

    // Recalculate health score for the analysis run
    const runId = (finding.analysis_runs as any).id;
    const newHealthScore = await calculateHealthScore(runId);

    // Update analysis run health score
    const { error: runUpdateError } = await supabase
      .from('analysis_runs')
      .update({ health_score: newHealthScore })
      .eq('id', runId);

    if (runUpdateError) {
      logger.error('Error updating analysis run health score', { error: runUpdateError.message });
      return ApiErrors.internalError(correlationId);
    }

    // Update project health score
    const projectId = (finding.analysis_runs as any).project_id;
    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({ health_score: newHealthScore })
      .eq('id', projectId);

    if (projectUpdateError) {
      logger.error('Error updating project health score', { error: projectUpdateError.message });
      return ApiErrors.internalError(correlationId);
    }

    // Return success with new health score (200 OK)
    return createApiResponse(
      {
        success: true,
        finding_id: findingId,
        status,
        health_score: newHealthScore,
      },
      200,
      correlationId
    );
  } catch (error) {
    logger.error('Unexpected error in PATCH /api/findings/[id]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return ApiErrors.internalError(correlationId);
  }
}
