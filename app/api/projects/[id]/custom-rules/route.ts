/**
 * Custom Rules API
 * 
 * CRUD operations for custom analysis rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { createServerClient } from '@/lib/supabase/server';
import { validateCustomRule, validateCustomRuleYAML } from '@/lib/custom-rules';

/**
 * GET /api/projects/:id/custom-rules
 * List all custom rules for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const projectId = params.id;
    const supabase = await createClient();

    // Verify project ownership (RLS will handle this, but we check explicitly for better error messages)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Fetch custom rules
    const { data: rules, error } = await supabase
      .from('custom_rules')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch custom rules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch custom rules', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: rules || [] });
  } catch (error) {
    console.error('Error in GET /api/projects/:id/custom-rules:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/custom-rules
 * Create a new custom rule
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const projectId = params.id;
    const body = await request.json();

    // Check if YAML format is provided
    if (body.yaml) {
      // Validate YAML
      const validation = validateCustomRuleYAML(body.yaml);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid YAML', code: 'VALIDATION_ERROR', details: validation.errors },
          { status: 400 }
        );
      }

      // Use validated rule
      body.name = validation.rule!.name;
      body.description = validation.rule!.description;
      body.enabled = validation.rule!.enabled;
      body.severity = validation.rule!.severity;
      body.file_pattern = validation.rule!.file_pattern;
      body.content_pattern = validation.rule!.content_pattern;
      body.message = validation.rule!.message;
    } else {
      // Validate JSON format
      const validation = validateCustomRule(body);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid rule', code: 'VALIDATION_ERROR', details: validation.errors },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Create custom rule
    const { data: rule, error } = await supabase
      .from('custom_rules')
      .insert({
        project_id: projectId,
        name: body.name,
        description: body.description || null,
        enabled: body.enabled !== undefined ? body.enabled : true,
        severity: body.severity,
        file_pattern: body.file_pattern,
        content_pattern: body.content_pattern || null,
        message: body.message,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create custom rule:', error);
      return NextResponse.json(
        { error: 'Failed to create custom rule', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: rule }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/projects/:id/custom-rules:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
