/**
 * Next.js Instrumentation
 * 
 * This file runs once when the Next.js server starts.
 * Use it for:
 * - Server-side monitoring initialization
 * - Environment variable validation
 * - Global setup
 */

import { initSentryServer } from './lib/monitoring/sentry';

/**
 * Register function runs on server startup
 */
export async function register() {
  // Initialize server-side error tracking
  initSentryServer();

  // Validate environment variables
  try {
    // Import env validation (will throw if variables are missing)
    await import('./lib/config/env');
    console.log('✓ Environment variables validated successfully');
  } catch (error) {
    console.error('✗ Environment validation failed:', error);
    // In production, we want to fail fast
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }

  console.log('✓ DevSentinel server instrumentation complete');
}
