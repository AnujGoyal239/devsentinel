/**
 * User Data Export Endpoint
 * 
 * Exports all user data as JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('User data export requested', { userId: user.id });

    // Fetch all user data
    const [
      userData,
      projectsData,
      documentsData,
      requirementsData,
      analysisRunsData,
      findingsData,
      fixJobsData,
    ] = await Promise.all([
      // User profile
      supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single(),

      // Projects
      supabaseAdmin
        .from('projects')
        .select('*')
        .eq('user_id', user.id),

      // Documents
      supabaseAdmin
        .from('documents')
        .select('*')
        .eq('user_id', user.id),

      // Requirements
      supabaseAdmin
        .from('requirements')
        .select('*')
        .eq('user_id', user.id),

      // Analysis runs
      supabaseAdmin
        .from('analysis_runs')
        .select('*')
        .in('project_id', 
          supabaseAdmin
            .from('projects')
            .select('id')
            .eq('user_id', user.id)
        ),

      // Findings
      supabaseAdmin
        .from('findings')
        .select('*')
        .in('run_id',
          supabaseAdmin
            .from('analysis_runs')
            .select('id')
            .in('project_id',
              supabaseAdmin
                .from('projects')
                .select('id')
                .eq('user_id', user.id)
            )
        ),

      // Fix jobs
      supabaseAdmin
        .from('fix_jobs')
        .select('*')
        .in('finding_id',
          supabaseAdmin
            .from('findings')
            .select('id')
            .in('run_id',
              supabaseAdmin
                .from('analysis_runs')
                .select('id')
                .in('project_id',
                  supabaseAdmin
                    .from('projects')
                    .select('id')
                    .eq('user_id', user.id)
                )
            )
        ),
    ]);

    // Check for errors
    if (userData.error) {
      throw new Error(`Failed to fetch user data: ${userData.error.message}`);
    }

    // Sanitize sensitive data
    const sanitizedUser = {
      ...userData.data,
      github_token: undefined, // Remove sensitive token
    };

    // Compile export data
    const exportData = {
      export_date: new Date().toISOString(),
      user: sanitizedUser,
      projects: projectsData.data || [],
      documents: documentsData.data || [],
      requirements: requirementsData.data || [],
      analysis_runs: analysisRunsData.data || [],
      findings: findingsData.data || [],
      fix_jobs: fixJobsData.data || [],
      statistics: {
        total_projects: projectsData.data?.length || 0,
        total_documents: documentsData.data?.length || 0,
        total_requirements: requirementsData.data?.length || 0,
        total_analysis_runs: analysisRunsData.data?.length || 0,
        total_findings: findingsData.data?.length || 0,
        total_fix_jobs: fixJobsData.data?.length || 0,
      },
    };

    logger.info('User data export completed', {
      userId: user.id,
      dataSize: JSON.stringify(exportData).length,
    });

    // Return JSON file
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="devsentinel-data-${user.id}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    logger.error('Error in user data export endpoint', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
