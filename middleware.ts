/**
 * Next.js Middleware
 * 
 * Handles:
 * 1. Authentication guard for protected routes
 * 2. Rate limiting for API routes
 * 3. Request logging and monitoring
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withMiddlewareAuthRequired } from '@auth0/nextjs-auth0/edge';
import { ratelimit } from './lib/redis/client';
import { authenticateApiKey, isValidApiKeyFormat } from './lib/auth/api-keys';

/**
 * Protected route patterns
 */
const protectedRoutes = [
  '/dashboard',
  '/project',
  '/api/projects',
  '/api/findings',
  '/api/stream',
];

/**
 * Public routes that don't require authentication
 */
const publicRoutes = [
  '/',
  '/login',
  '/api/auth',
  '/api/webhooks',
];

/**
 * Check if a path matches any protected route pattern
 */
function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(route => pathname.startsWith(route));
}

/**
 * Check if a path is a public route
 */
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => pathname.startsWith(route));
}

/**
 * Health check endpoints that are exempt from rate limiting
 */
const healthCheckRoutes = [
  '/api/health',
  '/health',
];

/**
 * Check if a path is a health check endpoint
 */
function isHealthCheckRoute(pathname: string): boolean {
  return healthCheckRoutes.some(route => pathname === route);
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://app.posthog.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://*.supabase.co https://app.posthog.com https://*.auth0.com; " +
    "frame-ancestors 'none';"
  );

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // Strict Transport Security (HTTPS only)
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );

  return response;
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH0_BASE_URL || 'http://localhost:3000';

  // Only allow requests from the application domain
  if (origin === allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
  }

  return response;
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    return addCorsHeaders(addSecurityHeaders(response), request);
  }

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next();
    return addCorsHeaders(addSecurityHeaders(response), request);
  }

  // Protected routes require authentication (JWT or API key)
  if (isProtectedRoute(pathname)) {
    try {
      let userId: string | null = null;
      let isApiKeyAuth = false;

      // Check for API key authentication first (for programmatic access)
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // Check if it's an API key (starts with ds_)
        if (isValidApiKeyFormat(token)) {
          userId = await authenticateApiKey(token);
          isApiKeyAuth = true;
        }
      }

      // Fall back to JWT authentication if no API key
      if (!userId) {
        const session = await getSession(request);
        
        if (!session || !session.user) {
          // Redirect to login if not authenticated
          const loginUrl = new URL('/api/auth/login', request.url);
          loginUrl.searchParams.set('returnTo', pathname);
          return NextResponse.redirect(loginUrl);
        }

        userId = session.user.sub;
      }

      // Apply rate limiting to API routes (except health checks)
      if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth') && !isHealthCheckRoute(pathname)) {
        const { success, limit, remaining, reset } = await ratelimit.limit(userId);

        if (!success) {
          const response = new NextResponse(
            JSON.stringify({
              error: 'Too Many Requests',
              code: 'RATE_LIMIT_EXCEEDED',
              limit,
              remaining: 0,
              reset: new Date(reset).toISOString(),
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'X-RateLimit-Limit': limit.toString(),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': reset.toString(),
              },
            }
          );
          return addCorsHeaders(addSecurityHeaders(response), request);
        }

        // Add rate limit headers to successful requests
        const response = NextResponse.next();
        response.headers.set('X-RateLimit-Limit', limit.toString());
        response.headers.set('X-RateLimit-Remaining', remaining.toString());
        response.headers.set('X-RateLimit-Reset', reset.toString());
        
        // Add authentication method header for debugging
        if (isApiKeyAuth) {
          response.headers.set('X-Auth-Method', 'api-key');
        }
        
        return addCorsHeaders(addSecurityHeaders(response), request);
      }

      const response = NextResponse.next();
      
      // Add authentication method header for debugging
      if (isApiKeyAuth) {
        response.headers.set('X-Auth-Method', 'api-key');
      }
      
      return addCorsHeaders(addSecurityHeaders(response), request);
    } catch (error) {
      console.error('Middleware error:', error);
      
      // Redirect to login on authentication errors
      const loginUrl = new URL('/api/auth/login', request.url);
      loginUrl.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Allow all other routes with security headers
  const response = NextResponse.next();
  return addCorsHeaders(addSecurityHeaders(response), request);
}

/**
 * Middleware configuration
 * Specify which routes should run through middleware
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
