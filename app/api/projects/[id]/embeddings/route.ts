/**
 * API endpoint for vector operations
 * 
 * POST - Generate embeddings for project files
 * GET - Search for similar files
 * DELETE - Clean up collection when project is deleted
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { createServerClient } from '@/lib/supabase/server';
import { storeEmbeddings, searchSimilarFiles, deleteCollection } from '@/lib/vector/qdrant';
import { fetchFileContent } from '@/lib/github/client';
import { filterFilesForEmbedding } from '@/lib/vector';
import { redis } from '@/lib/redis/client';

const CACHE_TTL = 300; // 5 minutes

/**
 * POST /api/projects/[id]/embeddings
 * Generate embeddings for project files
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const supabase = createServerClient();

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch file tree from GitHub
    const { data: user } = await supabase
      .from('users')
      .select('github_token')
      .eq('id', session.user.sub)
      .single();

    if (!user?.github_token) {
      return NextResponse.json({ error: 'GitHub token not found' }, { status: 400 });
    }

    // Get files from GitHub (filter out binary and large files)
    const response = await fetch(
      `https://api.github.com/repos/${project.repo_owner}/${project.repo_name}/git/trees/${project.branch}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${user.github_token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const treeData = await response.json();
    const allFiles = treeData.tree.filter((file: any) => file.type === 'blob');
    
    // Use the centralized filter function
    const files = filterFilesForEmbedding(
      allFiles.map((f: any) => ({ path: f.path, size: f.size }))
    ).map(filtered => {
      // Find the original file object
      return allFiles.find((f: any) => f.path === filtered.path);
    });

    // Process files in batches of 10
    const BATCH_SIZE = 10;
    const fileEmbeddings = [];

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (file: any) => {
        try {
          const content = await fetchFileContent(
            project.repo_owner,
            project.repo_name,
            file.path,
            user.github_token
          );

          return {
            id: file.sha,
            file_path: file.path,
            content,
            sha: file.sha,
          };
        } catch (error) {
          console.error(`Failed to fetch ${file.path}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      fileEmbeddings.push(...batchResults.filter(Boolean));
    }

    // Store embeddings in Qdrant
    await storeEmbeddings(projectId, fileEmbeddings as any);

    return NextResponse.json({
      success: true,
      files_processed: fileEmbeddings.length,
    });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return NextResponse.json(
      { error: 'Failed to generate embeddings' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/embeddings?query=...&topK=5
 * Search for similar files
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const topK = parseInt(searchParams.get('topK') || '5');
    const excludePath = searchParams.get('excludePath') || undefined;

    if (!query) {
      return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check cache first
    const cacheKey = `search:${projectId}:${query}:${topK}:${excludePath || ''}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return NextResponse.json(JSON.parse(cached as string));
    }

    // Search in Qdrant
    const results = await searchSimilarFiles(projectId, query, topK, excludePath);

    // Cache results
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(results));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching embeddings:', error);
    return NextResponse.json(
      { error: 'Failed to search embeddings' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/embeddings
 * Clean up collection when project is deleted
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const supabase = createServerClient();

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete collection from Qdrant
    await deleteCollection(projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting embeddings:', error);
    return NextResponse.json(
      { error: 'Failed to delete embeddings' },
      { status: 500 }
    );
  }
}
