/**
 * Document Upload API Endpoint
 * 
 * POST /api/projects/[id]/documents
 * Handles PRD document upload, parsing, and requirement extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createServerClient } from '@/lib/supabase/server';
import { parseDocument, type FileType } from '@/lib/parsers';
import { extractRequirements } from '@/lib/ai/groq-client';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown'];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, DOCX, and Markdown files are supported.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Verify project ownership
    const supabase = await createServerClient();
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Determine file type
    let fileType: FileType;
    if (file.type === 'application/pdf') {
      fileType = 'pdf';
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      fileType = 'docx';
    } else {
      fileType = 'md';
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const storagePath = `${user.id}/${projectId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('prd-uploads')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      );
    }

    // Parse document
    let parsedContent: string;
    try {
      parsedContent = await parseDocument(buffer, fileType);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      // Clean up uploaded file
      await supabase.storage.from('prd-uploads').remove([storagePath]);
      return NextResponse.json(
        { error: 'Failed to parse document' },
        { status: 500 }
      );
    }

    // Create document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        filename: file.name,
        file_type: fileType,
        storage_path: storagePath,
        parsed_content: parsedContent,
      })
      .select()
      .single();

    if (docError || !document) {
      console.error('Document insert error:', docError);
      // Clean up uploaded file
      await supabase.storage.from('prd-uploads').remove([storagePath]);
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      );
    }

    // Extract requirements using AI
    let requirements: any[] = [];
    try {
      const extractedRequirements = await extractRequirements(parsedContent);
      
      // Store requirements in database
      const requirementsToInsert = extractedRequirements.map((req) => ({
        document_id: document.id,
        project_id: projectId,
        category: req.category,
        feature_name: req.feature_name,
        description: req.description || null,
        endpoint: req.endpoint || null,
        expected_behavior: req.expected_behavior || null,
        priority: req.priority,
      }));

      if (requirementsToInsert.length > 0) {
        const { data: insertedReqs, error: reqError } = await supabase
          .from('requirements')
          .insert(requirementsToInsert)
          .select();

        if (reqError) {
          console.error('Requirements insert error:', reqError);
        } else {
          requirements = insertedReqs || [];
        }
      }
    } catch (aiError) {
      console.error('AI extraction error:', aiError);
      // Continue without requirements - this is not a fatal error
    }

    return NextResponse.json({
      document: {
        id: document.id,
        filename: document.filename,
        file_type: document.file_type,
        created_at: document.created_at,
      },
      requirements_count: requirements.length,
      parsed_content_preview: parsedContent.substring(0, 500),
    }, { status: 201 });

  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
