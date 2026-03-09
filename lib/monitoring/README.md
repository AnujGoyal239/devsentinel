# Monitoring and Observability

This directory contains all monitoring, error tracking, analytics, and logging utilities for DevSentinel.

## Overview

The monitoring system provides:

1. **Error Tracking (Sentry)**: Captures all unhandled exceptions across frontend, API routes, and Inngest functions
2. **Product Analytics (PostHog)**: Tracks user behavior and feature adoption
3. **Structured Logging**: JSON logs for all API requests, Inngest jobs, GitHub API calls, AI model calls, and E2B sandbox events
4. **Automatic Wrappers**: Middleware for API routes and Inngest functions

## Components

### 1. Sentry Error Tracking (`sentry.ts`)

Captures and reports all unhandled exceptions with user and request context.

**Features:**
- Automatic breadcrumb capture for debugging
- Sensitive data sanitization (tokens, API keys)
- User context (user_id, username)
- Request context (route, method, status code)

**Usage:**

```typescript
import { captureException, addBreadcrumb } from '@/lib/monitoring';

// Capture an exception with context
try {
  await riskyOperation();
} catch (error) {
  captureException(error, {
    userId: 'user-123',
    username: 'john',
    route: '/api/projects',
    method: 'POST',
    statusCode: 500,
  });
  throw error;
}

// Add breadcrumb for debugging
addBreadcrumb('User clicked analyze button', {
  projectId: 'proj-123',
  timestamp: Date.now(),
});
```

### 2. PostHog Analytics (`posthog.ts`)

Tracks product events and user behavior.

**Pre-defined Events:**
- `user_signed_in`: User completes authentication
- `analysis_started`: Analysis run starts
- `analysis_completed`: Analysis run completes
- `fix_triggered`: User triggers Auto-Fix
- `fix_pr_opened`: PR is opened successfully
- `report_exported`: User exports report to PDF

**Usage:**

```typescript
import { analytics, identifyUser } from '@/lib/monitoring';

// Identify user
identifyUser('user-123', {
  username: 'john',
  email: 'john@example.com',
  created_at: '2024-01-01T00:00:00Z',
});

// Track events
analytics.userSignedIn('user-123', 'john');
analytics.analysisStarted('proj-123', 500, true);
analytics.analysisCompleted('proj-123', 120000, 85, {
  bug: 5,
  security: 2,
  production: 3,
  prd_compliance: 1,
});
analytics.fixTriggered('finding-123', 'high', 'bug');
analytics.fixPrOpened('finding-123', 180000, 'https://github.com/...');
analytics.reportExported('proj-123', 'pdf');
```

### 3. Structured Logging (`logger.ts`)

Provides consistent JSON logging with correlation IDs and automatic sanitization.

**Features:**
- Correlation IDs for request tracing
- Automatic sensitive data redaction
- Structured JSON format in production
- Pretty-print in development

**Usage:**

```typescript
import { createLogger } from '@/lib/monitoring';

const logger = createLogger();

logger.info('Processing analysis', {
  projectId: 'proj-123',
  fileCount: 500,
});

logger.error('Analysis failed', {
  projectId: 'proj-123',
  error: 'Rate limit exceeded',
});

// Get correlation ID for passing to child operations
const correlationId = logger.getCorrelationId();
```

**Pre-defined Loggers:**

```typescript
import {
  logApiRequest,
  logInngestJobStart,
  logInngestJobComplete,
  logGitHubApiCall,
  logAiModelCall,
  logE2bSandboxEvent,
} from '@/lib/monitoring';

// API request logging
logApiRequest('POST', '/api/projects', 201, 150, 'user-123');

// Inngest job logging
logInngestJobStart('job-123', 'analysis/run', { project_id: 'proj-123' });
logInngestJobComplete('job-123', 'success', 120000, { findings: 10 });

// GitHub API logging
logGitHubApiCall('GET /repos/owner/repo', 200, 4999, 250);

// AI model logging
logAiModelCall('gemini-flash', 1500, 2000, true);

// E2B sandbox logging
logE2bSandboxEvent('create', 'sandbox-123', 8000);
logE2bSandboxEvent('destroy', 'sandbox-123', 500);
```

### 4. API Route Wrapper (`api-wrapper.ts`)

Automatically wraps API routes with error tracking and logging.

**Usage:**

```typescript
import { withMonitoring, createApiResponse, createErrorResponse } from '@/lib/monitoring';
import { NextRequest } from 'next/server';

export const GET = withMonitoring(async (req: NextRequest) => {
  // Your handler logic
  const data = await fetchData();
  
  // Return response (correlation ID added automatically)
  return createApiResponse(data, 200);
});

export const POST = withMonitoring(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const result = await createResource(body);
    return createApiResponse(result, 201);
  } catch (error) {
    // Errors are automatically captured to Sentry
    return createErrorResponse(
      'Failed to create resource',
      'CREATE_FAILED',
      400
    );
  }
});
```

### 5. Inngest Function Wrapper (`inngest-wrapper.ts`)

Automatically wraps Inngest functions with error tracking and logging.

**Usage:**

```typescript
import { inngest } from '@/inngest/client';
import { withInngestMonitoring, monitoredStep } from '@/lib/monitoring';

export const analysisRun = inngest.createFunction(
  { id: 'analysis-run', retries: 2 },
  { event: 'analysis/run' },
  withInngestMonitoring(async ({ event, step }) => {
    // Monitored step execution
    const codebaseContext = await monitoredStep(
      step,
      'understand-codebase',
      async () => {
        return await analyzeCodebase(event.data.project_id);
      }
    );

    const findings = await monitoredStep(
      step,
      'detect-bugs',
      async () => {
        return await detectBugs(codebaseContext);
      }
    );

    return { findings };
  })
);
```

### 6. External API Wrappers (`external-api-wrappers.ts`)

Monitored wrappers for GitHub API, AI models, and E2B sandbox.

**GitHub API:**

```typescript
import { MonitoredOctokit } from '@/lib/monitoring';

const octokit = new MonitoredOctokit({
  auth: githubToken,
});

// All requests are automatically logged
const { data } = await octokit.repos.get({
  owner: 'owner',
  repo: 'repo',
});
```

**AI Model Calls:**

```typescript
import { monitoredAiCall } from '@/lib/monitoring';

const result = await monitoredAiCall(
  'gemini-flash',
  async () => {
    return await gemini.generateContent(prompt);
  },
  (result) => result.response.usageMetadata.totalTokenCount
);
```

**E2B Sandbox:**

```typescript
import { MonitoredE2bSandbox } from '@/lib/monitoring';

const monitor = new MonitoredE2bSandbox(sandbox.id);

// Log creation
const createStart = Date.now();
const sandbox = await Sandbox.create();
await monitor.logCreate(Date.now() - createStart);

// Monitor operations
await monitor.monitorOperation('clone-repo', async () => {
  await sandbox.commands.run('git clone ...');
});

// Log destruction
const destroyStart = Date.now();
await sandbox.kill();
await monitor.logDestroy(Date.now() - destroyStart);
```

## Configuration

### Environment Variables

Required environment variables:

```bash
# Sentry
SENTRY_DSN=https://...@sentry.io/...

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### Initialization

**Client-side (app/providers.tsx):**

```typescript
'use client';

import { useEffect } from 'react';
import { initSentryClient, initPostHog } from '@/lib/monitoring';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initSentryClient();
    initPostHog();
  }, []);

  return <>{children}</>;
}
```

**Server-side (instrumentation.ts):**

```typescript
import { initSentryServer } from '@/lib/monitoring';

export async function register() {
  initSentryServer();
}
```

**Inngest (inngest/client.ts):**

Sentry integration is automatically configured in the Inngest client.

## Best Practices

### 1. Always Use Wrappers

✅ **Good:**
```typescript
export const GET = withMonitoring(async (req) => {
  // Handler logic
});
```

❌ **Bad:**
```typescript
export async function GET(req: NextRequest) {
  // No monitoring
}
```

### 2. Add Context to Errors

✅ **Good:**
```typescript
captureException(error, {
  userId: user.id,
  username: user.name,
  route: '/api/projects',
  method: 'POST',
});
```

❌ **Bad:**
```typescript
captureException(error); // No context
```

### 3. Use Correlation IDs

✅ **Good:**
```typescript
const logger = createLogger();
const correlationId = logger.getCorrelationId();
await childOperation(correlationId);
```

❌ **Bad:**
```typescript
// No correlation between parent and child operations
```

### 4. Track Key Events

✅ **Good:**
```typescript
analytics.analysisCompleted(projectId, duration, healthScore, findingCounts);
```

❌ **Bad:**
```typescript
// No analytics tracking
```

### 5. Never Log Sensitive Data

The logger automatically sanitizes sensitive data, but be careful with custom logging:

✅ **Good:**
```typescript
logger.info('User authenticated', { userId: user.id });
```

❌ **Bad:**
```typescript
logger.info('User authenticated', { token: user.githubToken }); // Will be redacted
```

## Testing

All monitoring utilities are designed to gracefully handle missing configuration:

- If `SENTRY_DSN` is not set, Sentry operations are no-ops
- If `NEXT_PUBLIC_POSTHOG_KEY` is not set, PostHog operations are no-ops
- Logging always works (stdout in production, pretty-print in development)

This allows development without requiring all monitoring services to be configured.

## Troubleshooting

### Sentry Not Capturing Errors

1. Check `SENTRY_DSN` is set correctly
2. Verify `initSentryServer()` is called in `instrumentation.ts`
3. Verify `initSentryClient()` is called in `app/providers.tsx`
4. Check Sentry dashboard for rate limits

### PostHog Not Tracking Events

1. Check `NEXT_PUBLIC_POSTHOG_KEY` is set correctly
2. Verify `initPostHog()` is called in `app/providers.tsx`
3. Check browser console for PostHog errors
4. Verify events in PostHog dashboard (may take a few minutes)

### Logs Not Appearing

1. Check `NODE_ENV` - production uses JSON format, development uses pretty-print
2. Verify logger is created with `createLogger()`
3. Check stdout/stderr for log output
4. Ensure sensitive data isn't being completely redacted

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Browser)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Sentry     │  │   PostHog    │  │  React Error │      │
│  │   Client     │  │   Client     │  │  Boundaries  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Routes (Next.js)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  withMonitoring Wrapper                              │   │
│  │  • Logs all requests                                 │   │
│  │  • Captures exceptions to Sentry                     │   │
│  │  • Adds correlation IDs                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Inngest Functions                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  withInngestMonitoring Wrapper                       │   │
│  │  • Logs job start/complete/failure                   │   │
│  │  • Captures step failures to Sentry                  │   │
│  │  • Tracks execution time                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              External APIs (GitHub, AI, E2B)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Monitored Wrappers                                  │   │
│  │  • MonitoredOctokit (GitHub)                         │   │
│  │  • monitoredAiCall (Gemini, Claude)                  │   │
│  │  • MonitoredE2bSandbox (E2B)                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Compliance

All monitoring utilities automatically sanitize sensitive data:

- GitHub tokens (ghp_, gho_, ghs_)
- API keys (OpenAI, Google, etc.)
- Bearer tokens
- Password fields
- Any field containing "token", "key", "secret", "password", or "auth"

This ensures compliance with:
- Requirement 20.10: Never log GitHub OAuth tokens
- Requirement 21.7: Sanitize sensitive data before sending to Sentry
- Requirement 34.10: Never log sensitive data including OAuth tokens, API keys, or passwords
