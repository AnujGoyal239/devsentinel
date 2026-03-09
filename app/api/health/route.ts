/**
 * Health Check Endpoint
 * 
 * Provides a simple health check for monitoring and load balancers.
 * This endpoint is exempt from rate limiting and authentication.
 * 
 * Returns:
 * - 200 OK: Service is healthy
 * - 503 Service Unavailable: Service is unhealthy
 */

import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * 
 * Health check endpoint that verifies:
 * 1. API is responding
 * 2. Redis connection is working
 */
export async function GET() {
  try {
    // Check Redis connectivity
    await redis.ping();

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          api: 'up',
          redis: 'up',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          api: 'up',
          redis: 'down',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
