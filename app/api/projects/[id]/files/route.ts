/**
 * Project Files API Route
 * 
 * GET /api/projects/:id/files - Fetch repository file tree from GitHub
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { fetchRepoTree } from '@/lib/github/client';
import { detectTechStack } from '@/lib/github/tech-stack';
import { decrypt } from '@/lib/auth/encryption';

/**
 * GET /api/projects/:id/files
 * Fetch file tree from GitHub and detect tech stack
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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
      // Fetch file tree from GitHub
      const fileTree = await fetchRepoTree(
        project.repo_owner,
        project.repo_name,
        project.branch,
        githubToken
      );

      // Detect tech stack if not already detected
      let techStack = project.tech_stack;
      if (!techStack) {
        const filePaths = fileTree.files.map(f => f.path);
        techStack = await detectTechStack(
          project.repo_owner,
          project.repo_name,
          filePaths,
          githubToken
        );

        // Update project with detected tech stack
        if (techStack) {
          await supabase
            .from('projects')
            .update({ tech_stack: techStack })
            .eq('id', project.id);
        }
      }

      return NextResponse.json({
        files: fileTree.files,
        total: fileTree.total,
        tech_stack: techStack,
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
          { error: 'Repository not found or not accessible', code: 'REPO_NOT_FOUND' },
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
        { error: 'Failed to fetch repository files', code: 'GITHUB_ERROR' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error in GET /api/projects/:id/files:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
