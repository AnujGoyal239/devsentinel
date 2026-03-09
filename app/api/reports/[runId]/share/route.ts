/**
 * Report Sharing API
 * 
 * POST /api/reports/:runId/share - Create shareable link
 * GET /api/reports/:runId/share - Get all shareable links for a run
 * DELETE /api/reports/:runId/share/:shareId - Revoke a shareable link
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMonitoring } from '@/lib/monitoring/api-wrapper';
import { supabase } from '@/lib/supabase/server';
import {
  createShareableLink,
  getShareableLinksForRun,
  revokeShareableLink,
} from '@/lib/sharing/report-share';

/**
 * POST /api/reports/:runId/share
 * Create a shareable link
 */
async function handlePost(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const runId = params.runId;

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Create shareable link
  const share = await createShareableLink(runId, user.id);

  if (!share) {
    return NextResponse.json(
      { success: false, error: 'Failed to create shareable link' },
      { status: 500 }
    );
  }

  // Generate full URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH0_BASE_URL || '';
  const shareUrl = `${baseUrl}/shared/${share.token}`;

  return NextResponse.json({
    success: true,
    data: {
      ...share,
      url: shareUrl,
    },
  }, { status: 201 });
}

/**
 * GET /api/reports/:runId/share
 * Get all shareable links for a run
 */
async function handleGet(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const runId = params.runId;

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get all shares
  const shares = await getShareableLinksForRun(runId, user.id);

  // Generate full URLs
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH0_BASE_URL || '';
  const sharesWithUrls = shares.map(share => ({
    ...share,
    url: `${baseUrl}/shared/${share.token}`,
  }));

  return NextResponse.json({
    success: true,
    data: sharesWithUrls,
  });
}

export const POST = withMonitoring(handlePost);
export const GET = withMonitoring(handleGet);
