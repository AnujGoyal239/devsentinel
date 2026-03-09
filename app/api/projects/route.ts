/**
 * Projects API Routes
 * 
 * POST /api/projects - Create a new project
 * GET /api/projects - List user's projects
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createApiResponse, ApiErrors, createLogger } from '@/lib/monitoring/api-wrapper';
import { handleDatabaseError } from '@/lib/supabase/errors';

/**
 * POST /api/projects
 * Create a new project
 */
export async function POST(request: NextRequest) {
  const logger = createLogger();
  const correlationId = logger.getCorrelationId();

  try {
    // Get authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return ApiErrors.unauthorized(undefined, correlationId);
    }

    // Parse request body
    const body = await request.json();
    const { name, repo_url, branch = 'main' } = body;

    // Validate required fields
    if (!name || !repo_url) {
      return ApiErrors.badRequest(
        'Missing required fields: name and repo_url',
        correlationId
      );
    }

    // Validate GitHub URL format
    const githubUrlPattern = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/?$/;
    const match = repo_url.match(githubUrlPattern);

    if (!match) {
      return ApiErrors.badRequest(
        'Invalid GitHub repository URL. Expected format: https://github.com/owner/repo',
        correlationId
      );
    }

    // Extract repo_owner and repo_name from URL
    const repo_owner = match[1];
    const repo_name = match[2];

    // Create project record
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name,
        repo_url,
        repo_owner,
        repo_name,
        branch,
        status: 'idle',
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating project', { error: error.message });
      const dbError = handleDatabaseError(error);
      
      if (dbError.isConnectionError) {
        return ApiErrors.internalError(correlationId);
      }
      
      return ApiErrors.badRequest(dbError.message, correlationId);
    }

    // Return 201 Created with the new project
    return createApiResponse(project, 201, correlationId);
  } catch (error) {
    logger.error('Unexpected error in POST /api/projects', {
      error: error instanceof Error ? error.message : String(error),
    });
    return ApiErrors.internalError(correlationId);
  }
}

/**
 * GET /api/projects
 * List all projects for authenticated user
 */
export async function GET(request: NextRequest) {
  const logger = createLogger();
  const correlationId = logger.getCorrelationId();

  try {
    // Get authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return ApiErrors.unauthorized(undefined, correlationId);
    }

    // Fetch projects sorted by updated_at DESC
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('Error fetching projects', { error: error.message });
      const dbError = handleDatabaseError(error);
      
      if (dbError.isConnectionError) {
        return ApiErrors.internalError(correlationId);
      }
      
      return ApiErrors.internalError(correlationId);
    }

    // Return 200 OK with projects array
    return createApiResponse(projects || [], 200, correlationId);
  } catch (error) {
    logger.error('Unexpected error in GET /api/projects', {
      error: error instanceof Error ? error.message : String(error),
    });
    return ApiErrors.internalError(correlationId);
  }
}
