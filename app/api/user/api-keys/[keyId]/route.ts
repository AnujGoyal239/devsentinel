/**
 * API Key Management - Individual Key Operations
 * 
 * DELETE /api/user/api-keys/:keyId - Revoke an API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { revokeApiKey } from '@/lib/auth/api-keys';

/**
 * DELETE /api/user/api-keys/:keyId
 * Revoke an API key (soft delete)
 * 
 * Returns: { success: true }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { keyId } = params;

    // Validate keyId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(keyId)) {
      return NextResponse.json(
        { error: 'Invalid key ID format', code: 'INVALID_KEY_ID' },
        { status: 400 }
      );
    }

    // Revoke the API key
    await revokeApiKey(keyId, user.id);

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
    });

  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      {
        error: 'Failed to revoke API key',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
