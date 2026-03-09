/**
 * Finding Comments API
 * 
 * GET /api/findings/:id/comments - Get all comments for a finding
 * POST /api/findings/:id/comments - Add a comment to a finding
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMonitoring } from '@/lib/monitoring/api-wrapper';
import { supabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/findings/:id/comments
 * Get all comments for a finding
 */
async function handleGet(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const findingId = params.id;

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify user has access to this finding
  const { data: finding, error: findingError } = await supabaseAdmin
    .from('findings')
    .select('run_id')
    .eq('id', findingId)
    .single();

  if (findingError || !finding) {
    return NextResponse.json(
      { success: false, error: 'Finding not found' },
      { status: 404 }
    );
  }

  const { data: run } = await supabaseAdmin
    .from('analysis_runs')
    .select('project_id')
    .eq('id', finding.run_id)
    .single();

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('user_id')
    .eq('id', run?.project_id || '')
    .single();

  if (!project || project.user_id !== user.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 403 }
    );
  }

  // Get comments with user information
  const { data: comments, error: commentsError } = await supabaseAdmin
    .from('finding_comments')
    .select(`
      id,
      comment_text,
      created_at,
      updated_at,
      users (
        id,
        username,
        avatar_url
      )
    `)
    .eq('finding_id', findingId)
    .order('created_at', { ascending: true });

  if (commentsError) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: comments || [],
  });
}

/**
 * POST /api/findings/:id/comments
 * Add a comment to a finding
 */
async function handlePost(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const findingId = params.id;

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Parse request body
  const body = await request.json();
  const { comment_text } = body;

  if (!comment_text || typeof comment_text !== 'string' || comment_text.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Comment text is required' },
      { status: 400 }
    );
  }

  if (comment_text.length > 5000) {
    return NextResponse.json(
      { success: false, error: 'Comment text is too long (max 5000 characters)' },
      { status: 400 }
    );
  }

  // Verify user has access to this finding
  const { data: finding, error: findingError } = await supabaseAdmin
    .from('findings')
    .select('run_id')
    .eq('id', findingId)
    .single();

  if (findingError || !finding) {
    return NextResponse.json(
      { success: false, error: 'Finding not found' },
      { status: 404 }
    );
  }

  const { data: run } = await supabaseAdmin
    .from('analysis_runs')
    .select('project_id')
    .eq('id', finding.run_id)
    .single();

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('user_id')
    .eq('id', run?.project_id || '')
    .single();

  if (!project || project.user_id !== user.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 403 }
    );
  }

  // Create comment
  const { data: comment, error: commentError } = await supabaseAdmin
    .from('finding_comments')
    .insert({
      finding_id: findingId,
      user_id: user.id,
      comment_text: comment_text.trim(),
    })
    .select(`
      id,
      comment_text,
      created_at,
      updated_at,
      users (
        id,
        username,
        avatar_url
      )
    `)
    .single();

  if (commentError || !comment) {
    return NextResponse.json(
      { success: false, error: 'Failed to create comment' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: comment,
  }, { status: 201 });
}

export const GET = withMonitoring(handleGet);
export const POST = withMonitoring(handlePost);
