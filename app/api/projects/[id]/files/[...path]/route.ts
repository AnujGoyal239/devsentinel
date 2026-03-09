/**
 * Project File Content API Route
 * 
 * GET /api/projects/:id/files/:path - Fetch individual file content from GitHub
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { fetchFileContent } from '@/lib/github/client';
import { decrypt } from '@/lib/auth/encryption';

/**
 * GET /api/projects/:id/files/:path
 * Fetch individual file content from GitHub
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; path: string[] } }
) {
  try {
    // Get authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Reconstruct file path from array
    const filePath = params.path.join('/');

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required', code: 'MISSING_PATH' },
        { status: 400 }
      );
    }

    // Fetch project (RLS ensures user owns this project)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get user's GitHub token
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('github_token')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.github_token) {
      return NextResponse.json(
        { error: 'GitHub token not found. Please re-authenticate.', code: 'NO_GITHUB_TOKEN' },
        { status: 401 }
      );
    }

    // Decrypt GitHub token
    const githubToken = decrypt(userData.github_token);

    try {
      // Fetch file content from GitHub
      const content = await fetchFileContent(
        project.repo_owner,
        project.repo_name,
        filePath,
        githubToken
      );

      return NextResponse.json({
        path: filePath,
        content,
        project_id: project.id,
        repo_owner: project.repo_owner,
        repo_name: project.repo_name,
      });
    } catch (githubError: any) {
      console.error('GitHub API error:', githubError);

      // Handle specific GitHub errors
      if (githubError?.status === 401) {
        return NextResponse.json(
          { error: 'GitHub authentication failed. Please re-authenticate.', code: 'GITHUB_AUTH_FAILED' },
          { status: 401 }
        );
      }

      if (githubError?.status === 404) {
        return NextResponse.json(
          { error: 'File not found in repository', code: 'FILE_NOT_FOUND' },
          { status: 404 }
        );
      }

      if (githubError?.status === 403 || githubError?.status === 429) {
        return NextResponse.json(
          { error: 'GitHub API rate limit exceeded. Please try again later.', code: 'RATE_LIMIT_EXCEEDED' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to fetch file content', code: 'GITHUB_ERROR' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error in GET /api/projects/:id/files/:path:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
