/**
 * API Route Wrapper with Error Tracking and Logging
 * 
 * Wraps Next.js API route handlers to automatically:
 * - Log all requests with timing
 * - Capture exceptions to Sentry
 * - Include user context in errors
 * - Sanitize sensitive data
 */

import { NextRequest, NextResponse } from 'next/server';
import { captureException } from './sentry';
import { logApiRequest, createLogger } from './logger';

// Re-export createLogger for use in API routes
export { createLogger };

export type ApiHandler = (
  req: NextRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Wrap an API route handler with monitoring
 */
export function withMonitoring(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, context?: { params: Record<string, string> }) => {
    const startTime = Date.now();
    const logger = createLogger();
    const correlationId = logger.getCorrelationId();

    // Extract user info from request headers (set by middleware)
    const userId = req.headers.get('x-user-id') || undefined;
    const username = req.headers.get('x-username') || undefined;

    try {
      // Execute the handler
      const response = await handler(req, context);
      
      // Log successful request
      const durationMs = Date.now() - startTime;
      logApiRequest(
        req.method,
        req.nextUrl.pathname,
        response.status,
        durationMs,
        userId,
        correlationId
      );

      // Add correlation ID to response headers
      response.headers.set('X-Correlation-ID', correlationId);

      return response;
    } catch (error) {
      // Log error
      const durationMs = Date.now() - startTime;
      logger.error('API route error', {
        method: req.method,
        path: req.nextUrl.pathname,
        duration_ms: durationMs,
        user_id: userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Capture to Sentry with context
      if (error instanceof Error) {
        captureException(error, {
          userId,
          username,
          route: req.nextUrl.pathname,
          method: req.method,
          statusCode: 500,
        });
      }

      // Return generic error response (never expose internal details in production)
      const isProduction = process.env.NODE_ENV === 'production';
      const errorMessage = isProduction
        ? 'An internal server error occurred. Please try again later.'
        : error instanceof Error
        ? error.message
        : 'Internal server error';

      return NextResponse.json(
        {
          error: errorMessage,
          code: 'INTERNAL_ERROR',
          request_id: correlationId,
        },
        { 
          status: 500,
          headers: {
            'X-Correlation-ID': correlationId,
          },
        }
      );
    }
  };
}

/**
 * Create a monitored API response
 * 
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @param correlationId - Optional correlation ID for tracking
 * @returns NextResponse with consistent format
 */
export function createApiResponse<T>(
  data: T,
  status: number = 200,
  correlationId?: string
): NextResponse {
  const response = NextResponse.json({ data }, { status });
  if (correlationId) {
    response.headers.set('X-Correlation-ID', correlationId);
  }
  return response;
}

/**
 * Create an error API response
 * 
 * @param error - Human-readable error message
 * @param code - Machine-readable error code
 * @param status - HTTP status code (default: 500)
 * @param correlationId - Optional correlation ID for tracking
 * @param additionalData - Optional additional error data (e.g., retry_after for 429)
 * @returns NextResponse with consistent error format
 */
export function createErrorResponse(
  error: string,
  code: string,
  status: number = 500,
  correlationId?: string,
  additionalData?: Record<string, any>
): NextResponse {
  const response = NextResponse.json(
    {
      error,
      code,
      request_id: correlationId,
      ...additionalData,
    },
    { status }
  );
  if (correlationId) {
    response.headers.set('X-Correlation-ID', correlationId);
  }
  return response;
}

/**
 * Standard error response helpers for common HTTP status codes
 */
export const ApiErrors = {
  /**
   * 400 Bad Request - Validation error
   */
  badRequest: (message: string, correlationId?: string) =>
    createErrorResponse(message, 'VALIDATION_ERROR', 400, correlationId),

  /**
   * 401 Unauthorized - Authentication required
   */
  unauthorized: (message: string = 'Authentication required', correlationId?: string) =>
    createErrorResponse(message, 'UNAUTHORIZED', 401, correlationId),

  /**
   * 403 Forbidden - Insufficient permissions
   */
  forbidden: (message: string = 'Insufficient permissions', correlationId?: string) =>
    createErrorResponse(message, 'FORBIDDEN', 403, correlationId),

  /**
   * 404 Not Found - Resource not found
   */
  notFound: (message: string = 'Resource not found', correlationId?: string) =>
    createErrorResponse(message, 'NOT_FOUND', 404, correlationId),

  /**
   * 429 Too Many Requests - Rate limit exceeded
   */
  tooManyRequests: (retryAfter: number, correlationId?: string) =>
    createErrorResponse(
      'Too many requests. Please try again later.',
      'RATE_LIMIT_EXCEEDED',
      429,
      correlationId,
      { retry_after: retryAfter }
    ),

  /**
   * 500 Internal Server Error - Generic server error
   */
  internalError: (correlationId?: string) =>
    createErrorResponse(
      'An internal server error occurred. Please try again later.',
      'INTERNAL_ERROR',
      500,
      correlationId
    ),
};
