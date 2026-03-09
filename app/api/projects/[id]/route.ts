/**
 * Project Detail API Route
 * 
 * GET /api/projects/[id] - Get single project by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createApiResponse, ApiErrors, createLogger } from '@/lib/monitoring/api-wrapper';
import { handleDatabaseError } from '@/lib/supabase/errors';

/**
 * GET /api/projects/[id]
 * Get single project by ID with related data
 */
export async function GET(
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

    const projectId = params.id;

    // Fetch project with related data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        documents (
          id,
          filename,
          file_type,
          created_at
        )
      `)
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError) {
      logger.error('Error fetching project', { error: projectError.message, projectId });
      const dbError = handleDatabaseError(projectError);
      
      if (dbError.code === 'NOT_FOUND') {
        return ApiErrors.notFound('Project not found', correlationId);
      }
      
      if (dbError.isConnectionError) {
        return ApiErrors.internalError(correlationId);
      }
      
      return ApiErrors.internalError(correlationId);
    }

    // Fetch latest analysis run
    const { data: latestRun } = await supabase
      .from('analysis_runs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Fetch requirements
    const { data: requirements } = await supabase
      .from('requirements')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    // Return project with latest run and requirements
    return createApiResponse(
      {
        ...project,
        latest_run: latestRun || null,
        requirements: requirements || [],
      },
      200,
      correlationId
    );
  } catch (error) {
    logger.error('Unexpected error in GET /api/projects/[id]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return ApiErrors.internalError(correlationId);
  }
}
