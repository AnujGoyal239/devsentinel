/**
 * API Route: GET /api/projects/[id]/findings
 * 
 * Fetches findings for a specific analysis run of a project.
 * Supports filtering by category and severity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { supabase } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');
    const category = searchParams.get('category');
    const severity = searchParams.get('severity');

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.sub)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // If runId is provided, fetch findings for that specific run
    // Otherwise, fetch findings from the most recent run
    let targetRunId = runId;
    
    if (!targetRunId) {
      const { data: latestRun } = await supabase
        .from('analysis_runs')
        .select('id')
        .eq('project_id', projectId)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!latestRun) {
        return NextResponse.json(
          { data: [], meta: { total: 0 } },
          { status: 200 }
        );
      }

      targetRunId = latestRun.id;
    }

    // Build query with optional filters
    let query = supabase
      .from('findings')
      .select('*')
      .eq('run_id', targetRunId);

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    // Order by severity (critical first) and then by file path
    query = query.order('severity', { ascending: true });
    query = query.order('file_path', { ascending: true });

    const { data: findings, error: findingsError } = await query;

    if (findingsError) {
      console.error('Error fetching findings:', findingsError);
      return NextResponse.json(
        { error: 'Failed to fetch findings', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: findings || [],
      meta: {
        total: findings?.length || 0,
        runId: targetRunId,
      },
    });
  } catch (error) {
    console.error('Unexpected error in findings API:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
