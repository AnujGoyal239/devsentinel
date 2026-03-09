/**
 * Project History API
 * 
 * GET /api/projects/:id/history - Get historical analysis runs
 * GET /api/projects/:id/history/trend - Get health score trend
 * GET /api/projects/:id/history/compare?current=X&previous=Y - Compare two runs
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMonitoring } from '@/lib/monitoring/api-wrapper';
import { supabase } from '@/lib/supabase/server';
import {
  getProjectHistory,
  getHealthScoreTrend,
  compareAnalysisRuns,
} from '@/lib/history/comparison';

/**
 * GET /api/projects/:id/history
 */
async function handleGet(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Get health score trend
  if (action === 'trend') {
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const trend = await getHealthScoreTrend(projectId, limit);

    return NextResponse.json({
      success: true,
      data: trend,
    });
  }

  // Compare two runs
  if (action === 'compare') {
    const currentRunId = searchParams.get('current');
    const previousRunId = searchParams.get('previous') || undefined;

    if (!currentRunId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing current run ID',
        },
        { status: 400 }
      );
    }

    const comparison = await compareAnalysisRuns(currentRunId, previousRunId);

    if (!comparison) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to compare analysis runs',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: comparison,
    });
  }

  // Get all historical runs
  const history = await getProjectHistory(projectId);

  return NextResponse.json({
    success: true,
    data: history,
  });
}

export const GET = withMonitoring(handleGet);
