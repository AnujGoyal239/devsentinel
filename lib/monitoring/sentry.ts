/**
 * Sentry Error Tracking Configuration
 * 
 * Captures and reports all unhandled exceptions across:
 * - Frontend React errors
 * - API route exceptions
 * - Inngest function failures
 */

import * as Sentry from '@sentry/nextjs';

const sentryDsn = process.env.SENTRY_DSN;
const environment = process.env.NODE_ENV || 'development';

/**
 * Initialize Sentry for client-side error tracking.
 * Call this in app/layout.tsx or a client component.
 */
export function initSentryClient() {
  if (!sentryDsn) {
    console.warn('SENTRY_DSN not set. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment,
    
    // Capture 100% of errors in production
    tracesSampleRate: environment === 'production' ? 1.0 : 0.1,
    
    // Session replay sample rate
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Filter out sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      // Remove sensitive query params
      if (event.request?.query_string) {
        event.request.query_string = event.request.query_string
          .replace(/token=[^&]+/g, 'token=[REDACTED]')
          .replace(/key=[^&]+/g, 'key=[REDACTED]');
      }
      
      return event;
    },
  });
}

/**
 * Initialize Sentry for server-side error tracking.
 * Call this in instrumentation.ts
 */
export function initSentryServer() {
  if (!sentryDsn) {
    console.warn('SENTRY_DSN not set. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment,
    
    tracesSampleRate: environment === 'production' ? 1.0 : 0.1,
    
    // Filter out sensitive data
    beforeSend(event) {
      // Remove GitHub tokens from error messages
      if (event.message) {
        event.message = event.message
          .replace(/ghp_[a-zA-Z0-9]{36}/g, 'ghp_[REDACTED]')
          .replace(/gho_[a-zA-Z0-9]{36}/g, 'gho_[REDACTED]');
      }
      
      // Remove sensitive environment variables
      if (event.contexts?.runtime?.env) {
        const env = event.contexts.runtime.env as Record<string, unknown>;
        delete env.SUPABASE_SERVICE_ROLE_KEY;
        delete env.AUTH0_CLIENT_SECRET;
        delete env.GROQ_API_KEY;
        delete env.E2B_API_KEY;
      }
      
      return event;
    },
  });
}

/**
 * Capture an exception with user context
 */
export function captureException(
  error: Error,
  context?: {
    userId?: string;
    username?: string;
    route?: string;
    method?: string;
    statusCode?: number;
  }
) {
  if (context) {
    Sentry.setContext('request', {
      route: context.route,
      method: context.method,
      statusCode: context.statusCode,
    });
    
    if (context.userId) {
      Sentry.setUser({
        id: context.userId,
        username: context.username,
      });
    }
  }
  
  Sentry.captureException(error);
}

/**
 * Capture a message with severity level
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
) {
  Sentry.captureMessage(message, level);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    data,
    timestamp: Date.now() / 1000,
  });
}
