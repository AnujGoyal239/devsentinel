/**
 * Monitoring and Observability
 * 
 * Centralized exports for:
 * - Error tracking (Sentry)
 * - Analytics (PostHog)
 * - Structured logging
 * - API/Inngest wrappers
 * - External API monitoring
 */

// Sentry error tracking
export {
  initSentryClient,
  initSentryServer,
  captureException,
  captureMessage,
  addBreadcrumb,
} from './sentry';

// PostHog analytics
export {
  initPostHog,
  identifyUser,
  trackEvent,
  resetUser,
  analytics,
} from './posthog';

// Structured logging
export {
  createLogger,
  logApiRequest,
  logInngestJobStart,
  logInngestJobComplete,
  logInngestJobFailure,
  logGitHubApiCall,
  logAiModelCall,
  logE2bSandboxEvent,
  type Logger,
  type LogLevel,
  type LogEntry,
} from './logger';

// API route wrapper
export {
  withMonitoring,
  createApiResponse,
  createErrorResponse,
  type ApiHandler,
} from './api-wrapper';

// Inngest wrapper
export {
  withInngestMonitoring,
  monitoredStep,
} from './inngest-wrapper';

// External API wrappers
export {
  MonitoredOctokit,
  monitoredAiCall,
  MonitoredE2bSandbox,
} from './external-api-wrappers';
