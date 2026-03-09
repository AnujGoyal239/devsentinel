# DevSentinel Infrastructure Setup

This document provides instructions for setting up the DevSentinel infrastructure foundation.

## Overview

DevSentinel uses a completely free-tier infrastructure stack:

- **Next.js 14** (Vercel Hobby) - Frontend and API
- **Supabase** (Free Tier) - PostgreSQL database with RLS
- **Auth0** (Free Tier) - GitHub OAuth authentication
- **Inngest** (Free Tier) - Background job queue
- **Upstash Redis** (Free Tier) - Rate limiting and caching
- **Gemini Flash** (Free Tier) - Code analysis AI
- **Claude Sonnet** (Anthropic) - Fix agent AI
- **E2B** (Free Tier) - Isolated code execution sandboxes
- **Sentry** (Free Tier) - Error tracking
- **PostHog** (Free Tier) - Product analytics

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all required values:

```bash
cp .env.example .env.local
```

### Required Variables

#### Auth0 (GitHub OAuth)
```bash
AUTH0_SECRET=                # Generate with: openssl rand -hex 32
AUTH0_BASE_URL=              # http://localhost:3000 (dev) or your production URL
AUTH0_ISSUER_BASE_URL=       # https://YOUR_TENANT.auth0.com
AUTH0_CLIENT_ID=             # From Auth0 application settings
AUTH0_CLIENT_SECRET=         # From Auth0 application settings
```

#### Supabase (Database)
```bash
NEXT_PUBLIC_SUPABASE_URL=        # From Supabase project settings
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # From Supabase project settings (public)
SUPABASE_SERVICE_ROLE_KEY=       # From Supabase project settings (secret)
```

#### AI Models
```bash
GEMINI_API_KEY=              # From Google AI Studio
ANTHROPIC_API_KEY=           # From Anthropic Console
GROQ_API_KEY=                # From Groq Console (fallback)
```

#### Infrastructure
```bash
E2B_API_KEY=                 # From E2B dashboard
JINA_API_KEY=                # From Jina AI
QDRANT_URL=                  # From Qdrant Cloud
QDRANT_API_KEY=              # From Qdrant Cloud
UPSTASH_REDIS_REST_URL=      # From Upstash Console
UPSTASH_REDIS_REST_TOKEN=    # From Upstash Console
INNGEST_SIGNING_KEY=         # From Inngest dashboard
INNGEST_EVENT_KEY=           # From Inngest dashboard
```

#### Integrations
```bash
RESEND_API_KEY=              # From Resend dashboard
```

#### Monitoring
```bash
SENTRY_DSN=                  # From Sentry project settings
NEXT_PUBLIC_POSTHOG_KEY=     # From PostHog project settings
NEXT_PUBLIC_POSTHOG_HOST=    # https://app.posthog.com (or self-hosted)
```

## Database Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy the project URL and keys to `.env.local`

### 2. Run Database Migration

Execute the SQL migration file in the Supabase SQL Editor:

```sql
-- Copy and paste the contents of:
-- supabase/migrations/001_initial_schema.sql
```

This will create:
- All database tables (users, projects, documents, requirements, analysis_runs, findings, fix_jobs)
- Row-Level Security policies
- Performance indexes
- Storage bucket for PRD uploads

### 3. Verify Setup

Run this query to verify tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

You should see: users, projects, documents, requirements, analysis_runs, findings, fix_jobs

## Auth0 Setup

### 1. Create Auth0 Application

1. Go to [auth0.com](https://auth0.com)
2. Create a new "Regular Web Application"
3. Configure settings:
   - **Allowed Callback URLs**: `http://localhost:3000/api/auth/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:3000`

### 2. Enable GitHub Connection

1. Go to Authentication → Social
2. Enable GitHub
3. Configure OAuth scopes:
   - Initial: `repo:read`
   - Escalated: `repo:write` (requested on first Auto-Fix)

### 3. Copy Credentials

Copy the following to `.env.local`:
- Domain → `AUTH0_ISSUER_BASE_URL`
- Client ID → `AUTH0_CLIENT_ID`
- Client Secret → `AUTH0_CLIENT_SECRET`

## Inngest Setup

### 1. Create Inngest Account

1. Go to [inngest.com](https://inngest.com)
2. Create a new project
3. Copy the Event Key and Signing Key to `.env.local`

### 2. Configure Webhook

In production, set the webhook URL to:
```
https://your-domain.com/api/inngest
```

## Upstash Redis Setup

1. Go to [upstash.com](https://upstash.com)
2. Create a new Redis database
3. Copy the REST URL and token to `.env.local`

## Monitoring Setup

### Sentry

1. Go to [sentry.io](https://sentry.io)
2. Create a new Next.js project
3. Copy the DSN to `.env.local`

### PostHog

1. Go to [posthog.com](https://posthog.com)
2. Create a new project
3. Copy the API key to `.env.local`

## Running the Application

### Development

```bash
npm run dev
```

The application will:
1. Validate all environment variables on startup
2. Initialize Sentry and PostHog
3. Start the Next.js development server on http://localhost:3000

### Production

Deploy to Vercel:

```bash
vercel
```

Make sure to set all environment variables in the Vercel project settings.

## Verification

### Check Environment Variables

The application validates all required environment variables on startup. If any are missing, you'll see an error message listing them.

### Check Database Connection

Visit `/api/health` (once implemented) to verify:
- Supabase connection
- Redis connection
- All services are operational

### Check Authentication

1. Visit http://localhost:3000
2. Click "Get Started"
3. You should be redirected to Auth0 GitHub OAuth
4. After authorization, you should be redirected back to the dashboard

## Troubleshooting

### Environment Variable Errors

If you see "Missing required environment variables", check:
1. `.env.local` file exists in the project root
2. All variables are set (no empty values)
3. Restart the development server after changes

### Database Connection Errors

If Supabase connection fails:
1. Verify the URL and keys are correct
2. Check that the migration was run successfully
3. Verify RLS policies are enabled

### Authentication Errors

If Auth0 login fails:
1. Verify callback URLs are configured correctly
2. Check that GitHub connection is enabled
3. Verify the Auth0 credentials in `.env.local`

## Next Steps

After completing the infrastructure setup:

1. **Task 1**: Implement Authentication System
2. **Task 2**: Implement Project Management
3. **Task 3**: Implement GitHub Integration
4. **Task 4**: Implement Analysis Pipeline
5. **Task 5**: Implement Fix Agent

See `tasks.md` for the complete implementation plan.
