/**
 * Custom Rule API (Single Rule)
 * 
 * Operations for a specific custom rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { createServerClient } from '@/lib/supabase/server';
import { validateCustomRule } from '@/lib/custom-rules';

/**
 * GET /api/projects/:id/custom-rules/:ruleId
 * Get a specific custom rule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id: projectId, ruleId } = params;
    const supabase = await createClient();

    // Fetch custom rule (RLS will ensure user owns the project)
    const { data: rule, error } = await supabase
      .from('custom_rules')
      .select('*')
      .eq('id', ruleId)
      .eq('project_id', projectId)
      .single();

    if (error || !rule) {
      return NextResponse.json(
        { error: 'Custom rule not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: rule });
  } catch (error) {
    console.error('Error in GET /api/projects/:id/custom-rules/:ruleId:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/:id/custom-rules/:ruleId
 * Update a custom rule
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id: projectId, ruleId } = params;
    const body = await request.json();

    // Validate if full rule is provided
    if (body.name || body.severity || body.file_pattern || body.message) {
      const validation = validateCustomRule({
        name: body.name,
        severity: body.severity,
        file_pattern: body.file_pattern,
        message: body.message,
        description: body.description,
        enabled: body.enabled,
        content_pattern: body.content_pattern,
      });

      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid rule', code: 'VALIDATION_ERROR', details: validation.errors },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    // Update custom rule (RLS will ensure user owns the project)
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.severity !== undefined) updateData.severity = body.severity;
    if (body.file_pattern !== undefined) updateData.file_pattern = body.file_pattern;
    if (body.content_pattern !== undefined) updateData.content_pattern = body.content_pattern;
    if (body.message !== undefined) updateData.message = body.message;

    const { data: rule, error } = await supabase
      .from('custom_rules')
      .update(updateData)
      .eq('id', ruleId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error || !rule) {
      console.error('Failed to update custom rule:', error);
      return NextResponse.json(
        { error: 'Failed to update custom rule', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: rule });
  } catch (error) {
    console.error('Error in PATCH /api/projects/:id/custom-rules/:ruleId:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id/custom-rules/:ruleId
 * Delete a custom rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id: projectId, ruleId } = params;
    const supabase = await createClient();

    // Delete custom rule (RLS will ensure user owns the project)
    const { error } = await supabase
      .from('custom_rules')
      .delete()
      .eq('id', ruleId)
      .eq('project_id', projectId);

    if (error) {
      console.error('Failed to delete custom rule:', error);
      return NextResponse.json(
        { error: 'Failed to delete custom rule', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Error in DELETE /api/projects/:id/custom-rules/:ruleId:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
