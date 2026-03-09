/**
 * API Keys Management Endpoints
 * 
 * POST /api/user/api-keys - Create a new API key
 * GET /api/user/api-keys - List user's API keys
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createApiKey, listApiKeys } from '@/lib/auth/api-keys';
import { z } from 'zod';

/**
 * POST /api/user/api-keys
 * Create a new API key
 * 
 * Body: { name: string }
 * Returns: { data: { id, name, key, key_prefix, created_at } }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const schema = z.object({
      name: z.string()
        .min(1, 'Name is required')
        .max(100, 'Name must be less than 100 characters')
        .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Name can only contain letters, numbers, spaces, hyphens, and underscores'),
    });

    const validation = schema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      const firstError = Object.values(errors)[0]?.[0] || 'Validation failed';
      return NextResponse.json(
        {
          error: firstError,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const { name } = validation.data;

    // Create the API key
    const apiKey = await createApiKey(user.id, name);

    // Return the full key (only time it's visible)
    return NextResponse.json({
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.key, // Full plaintext key - ONLY returned once
        key_prefix: apiKey.key_prefix,
        created_at: apiKey.created_at,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating API key:', error);

    // Handle duplicate name error
    if (error instanceof Error && error.message.includes('unique_user_key_name')) {
      return NextResponse.json(
        {
          error: 'An API key with this name already exists',
          code: 'DUPLICATE_NAME',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create API key',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/api-keys
 * List all API keys for the authenticated user
 * 
 * Returns: { data: ApiKey[] }
 */
export async function GET() {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Get all API keys for the user
    const apiKeys = await listApiKeys(user.id);

    // Return keys without the actual key values
    return NextResponse.json({
      data: apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        key_prefix: key.key_prefix,
        last_used_at: key.last_used_at,
        created_at: key.created_at,
        revoked_at: key.revoked_at,
        is_active: key.revoked_at === null,
      })),
    });

  } catch (error) {
    console.error('Error listing API keys:', error);
    return NextResponse.json(
      {
        error: 'Failed to list API keys',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
