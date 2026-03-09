/**
 * Comment Management API
 * 
 * PATCH /api/comments/:commentId - Update a comment
 * DELETE /api/comments/:commentId - Delete a comment
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMonitoring } from '@/lib/monitoring/api-wrapper';
import { supabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * PATCH /api/comments/:commentId
 * Update a comment
 */
async function handlePatch(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const commentId = params.commentId;

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

  // Verify user owns this comment
  const { data: existingComment } = await supabaseAdmin
    .from('finding_comments')
    .select('user_id')
    .eq('id', commentId)
    .single();

  if (!existingComment || existingComment.user_id !== user.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 403 }
    );
  }

  // Update comment
  const { data: comment, error: commentError } = await supabaseAdmin
    .from('finding_comments')
    .update({
      comment_text: comment_text.trim(),
    })
    .eq('id', commentId)
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
      { success: false, error: 'Failed to update comment' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: comment,
  });
}

/**
 * DELETE /api/comments/:commentId
 * Delete a comment
 */
async function handleDelete(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const commentId = params.commentId;

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify user owns this comment
  const { data: existingComment } = await supabaseAdmin
    .from('finding_comments')
    .select('user_id')
    .eq('id', commentId)
    .single();

  if (!existingComment || existingComment.user_id !== user.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 403 }
    );
  }

  // Delete comment
  const { error: deleteError } = await supabaseAdmin
    .from('finding_comments')
    .delete()
    .eq('id', commentId);

  if (deleteError) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete comment' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Comment deleted successfully',
  });
}

export const PATCH = withMonitoring(handlePatch);
export const DELETE = withMonitoring(handleDelete);
