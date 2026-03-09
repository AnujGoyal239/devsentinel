/**
 * Revoke Shareable Link API
 * 
 * DELETE /api/reports/share/:shareId - Revoke a shareable link
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMonitoring } from '@/lib/monitoring/api-wrapper';
import { supabase } from '@/lib/supabase/server';
import { revokeShareableLink } from '@/lib/sharing/report-share';

/**
 * DELETE /api/reports/share/:shareId
 * Revoke a shareable link
 */
async function handleDelete(
  request: NextRequest,
  { params }: { params: { shareId: string } }
) {
  const shareId = params.shareId;

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Revoke the share
  const success = await revokeShareableLink(shareId, user.id);

  if (!success) {
    return NextResponse.json(
      { success: false, error: 'Failed to revoke shareable link' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Shareable link revoked successfully',
  });
}

export const DELETE = withMonitoring(handleDelete);
