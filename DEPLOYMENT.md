# DevSentinel Deployment Guide

This guide covers deploying DevSentinel to production using Vercel, Supabase, and other free-tier services.

## Prerequisites

- GitHub account
- Vercel account (free tier)
- Supabase account (free tier)
- Auth0 account (free tier)
- Domain name (optional, Vercel provides free subdomain)

## Architecture Overview

```
┌─────────────┐
│   Vercel    │ ← Next.js App (Frontend + API Routes)
└──────┬──────┘
       │
       ├─────→ Supabase (PostgreSQL + Storage)
       ├─────→ Auth0 (Authentication)
       ├─────→ Inngest (Background Jobs)
       ├─────→ Upstash Redis (Rate Limiting + Cache)
       ├─────→ Qdrant Cloud (Vector Search)
       ├─────→ E2B (Code Sandboxes)
       ├─────→ Resend (Email)
       ├─────→ Sentry (Error Tracking)
       └─────→ PostHog (Analytics)
```

## Step 1: Database Setup (Supabase)

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and region (closest to your users)
4. Set database password (save this securely)
5. Wait for project to be created (~2 minutes)

### 1.2 Run Database Migrations

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Link to your project:
```bash
cd devsentinel
supabase link --project-ref your-project-ref
```

3. Run migrations:
```bash
supabase db push
```

Or manually run each migration file in the Supabase SQL Editor:
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_add_rls_policies.sql`
- `supabase/migrations/003_add_indexes.sql`
- `supabase/migrations/004_add_sandbox_id_to_fix_jobs.sql`
- `supabase/migrations/005_add_email_notifications.sql`
- `supabase/migrations/006_add_user_deletion_field.sql`
- `supabase/migrations/007_add_webhook_fields.sql`

### 1.3 Create Storage Bucket

1. Go to Storage in Supabase dashboard
2. Create new bucket: `documents`
3. Set to Public: No
4. Enable RLS policies

### 1.4 Get Connection Details

From Supabase Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL`: Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon/public key
- `SUPABASE_SERVICE_ROLE_KEY`: service_role key (keep secret!)

## Step 2: Authentication Setup (Auth0)

### 2.1 Create Auth0 Application

1. Go to [auth0.com](https://auth0.com)
2. Create new application → Regular Web Application
3. Name it "DevSentinel"

### 2.2 Configure Application

**Settings:**
- Allowed Callback URLs: `https://your-domain.com/api/auth/callback`
- Allowed Logout URLs: `https://your-domain.com`
- Allowed Web Origins: `https://your-domain.com`

**Connections:**
- Enable GitHub social connection
- Request scopes: `user:email`, `read:user`, `repo` (for read access)

### 2.3 Get Credentials

From Application Settings:
- `AUTH0_CLIENT_ID`: Client ID
- `AUTH0_CLIENT_SECRET`: Client Secret
- `AUTH0_ISSUER_BASE_URL`: Domain (e.g., `https://your-tenant.auth0.com`)
- `AUTH0_SECRET`: Generate with `openssl rand -hex 32`

## Step 3: Infrastructure Services

### 3.1 Inngest (Background Jobs)

1. Go to [inngest.com](https://www.inngest.com)
2. Create account and project
3. Get keys from Settings:
   - `INNGEST_EVENT_KEY`: Event Key
   - `INNGEST_SIGNING_KEY`: Signing Key

### 3.2 Upstash Redis (Rate Limiting)

1. Go to [upstash.com](https://upstash.com)
2. Create Redis database (free tier)
3. Get connection details:
   - `UPSTASH_REDIS_REST_URL`: REST URL
   - `UPSTASH_REDIS_REST_TOKEN`: REST Token

### 3.3 Qdrant Cloud (Vector Search)

1. Go to [qdrant.tech](https://qdrant.tech)
2. Create free cluster
3. Get credentials:
   - `QDRANT_URL`: Cluster URL
   - `QDRANT_API_KEY`: API Key

### 3.4 E2B (Code Sandboxes)

1. Go to [e2b.dev](https://e2b.dev)
2. Create account
3. Get API key:
   - `E2B_API_KEY`: API Key

### 3.5 Resend (Email)

1. Go to [resend.com](https://resend.com)
2. Create account
3. Add and verify your domain
4. Get API key:
   - `RESEND_API_KEY`: API Key
   - `RESEND_FROM_EMAIL`: Your verified email (e.g., `notifications@yourdomain.com`)

### 3.6 AI Model APIs

**Gemini (Google):**
1. Go to [ai.google.dev](https://ai.google.dev)
2. Get API key: `GEMINI_API_KEY`

**Anthropic (Claude):**
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Get API key: `ANTHROPIC_API_KEY`

**Groq (Fallback):**
1. Go to [console.groq.com](https://console.groq.com)
2. Get API key: `GROQ_API_KEY`

**Jina (Embeddings):**
1. Go to [jina.ai](https://jina.ai)
2. Get API key: `JINA_API_KEY`

### 3.7 Monitoring

**Sentry (Error Tracking):**
1. Go to [sentry.io](https://sentry.io)
2. Create project → Next.js
3. Get DSN: `SENTRY_DSN`

**PostHog (Analytics):**
1. Go to [posthog.com](https://posthog.com)
2. Create project
3. Get keys:
   - `NEXT_PUBLIC_POSTHOG_KEY`: Project API Key
   - `NEXT_PUBLIC_POSTHOG_HOST`: `https://app.posthog.com`

## Step 4: Vercel Deployment

### 4.1 Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Select "devsentinel" folder as root directory

### 4.2 Configure Environment Variables

Add all environment variables in Vercel dashboard:

```env
# Auth0
AUTH0_SECRET=<generated-secret>
AUTH0_BASE_URL=https://your-domain.vercel.app
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=<auth0-client-id>
AUTH0_CLIENT_SECRET=<auth0-client-secret>

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>

# AI Models
GEMINI_API_KEY=<gemini-key>
ANTHROPIC_API_KEY=<anthropic-key>
GROQ_API_KEY=<groq-key>

# Infrastructure
E2B_API_KEY=<e2b-key>
JINA_API_KEY=<jina-key>
QDRANT_URL=<qdrant-url>
QDRANT_API_KEY=<qdrant-key>
UPSTASH_REDIS_REST_URL=<upstash-url>
UPSTASH_REDIS_REST_TOKEN=<upstash-token>
INNGEST_SIGNING_KEY=<inngest-signing-key>
INNGEST_EVENT_KEY=<inngest-event-key>
GITHUB_WEBHOOK_SECRET=<generated-secret>

# Integrations
RESEND_API_KEY=<resend-key>
RESEND_FROM_EMAIL=notifications@yourdomain.com

# Monitoring
SENTRY_DSN=<sentry-dsn>
NEXT_PUBLIC_POSTHOG_KEY=<posthog-key>
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### 4.3 Deploy

1. Click "Deploy"
2. Wait for build to complete (~3-5 minutes)
3. Visit your deployment URL

### 4.4 Configure Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. Update `AUTH0_BASE_URL` and `NEXT_PUBLIC_APP_URL` to use custom domain

## Step 5: Post-Deployment Configuration

### 5.1 Update Auth0 URLs

Update Auth0 application settings with your production URL:
- Allowed Callback URLs: `https://your-domain.com/api/auth/callback`
- Allowed Logout URLs: `https://your-domain.com`
- Allowed Web Origins: `https://your-domain.com`

### 5.2 Configure Inngest

1. Go to Inngest dashboard
2. Add webhook URL: `https://your-domain.com/api/inngest`
3. Verify connection

### 5.3 Set Up GitHub Webhooks

For each repository you want to monitor:
1. Go to repository Settings → Webhooks
2. Add webhook: `https://your-domain.com/api/webhooks/github`
3. Set secret: `GITHUB_WEBHOOK_SECRET` value
4. Select events: Push, Pull Request, Release

### 5.4 Verify Health Check

```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-07T...",
  "services": {
    "redis": "connected"
  }
}
```

## Step 6: Monitoring Setup

### 6.1 Configure Alerts

**Sentry:**
- Set up alert rules for error rate > 1%
- Configure Slack/email notifications

**Vercel:**
- Enable deployment notifications
- Set up function error alerts

**Supabase:**
- Monitor database CPU usage
- Set up alerts for connection limits

### 6.2 Set Up Uptime Monitoring

Use a service like:
- UptimeRobot (free)
- Pingdom
- Better Uptime

Monitor:
- `https://your-domain.com/api/health`
- Alert if down > 1 minute

## Troubleshooting

### Build Failures

**Error: Missing environment variables**
- Verify all required env vars are set in Vercel
- Check for typos in variable names

**Error: Module not found**
- Clear Vercel cache and redeploy
- Verify package.json dependencies

### Runtime Errors

**500 Internal Server Error**
- Check Vercel function logs
- Verify database connection
- Check Sentry for error details

**Authentication not working**
- Verify Auth0 URLs match deployment URL
- Check AUTH0_SECRET is set
- Verify callback URLs are correct

**Webhooks failing**
- Check webhook signature verification
- Verify GITHUB_WEBHOOK_SECRET matches
- Check Inngest connection

## Rollback Procedure

If deployment has issues:

1. Go to Vercel dashboard
2. Find previous working deployment
3. Click "..." → "Promote to Production"
4. Investigate issues in staging

## Backup and Recovery

### Database Backups

Supabase automatically backs up your database:
- Point-in-time recovery available
- Daily backups retained for 7 days (free tier)

### Manual Backup

```bash
# Export database
supabase db dump -f backup.sql

# Restore database
supabase db reset
psql -h your-db-host -U postgres -d postgres -f backup.sql
```

### Disaster Recovery

1. Create new Supabase project
2. Run migrations
3. Restore from backup
4. Update environment variables in Vercel
5. Redeploy

## Performance Optimization

### Enable Caching

Vercel automatically caches:
- Static assets (images, CSS, JS)
- API routes with proper headers

### Database Optimization

- Ensure all indexes are created (migration 003)
- Monitor slow queries in Supabase
- Enable connection pooling (included in Supabase)

### CDN Configuration

Vercel Edge Network automatically:
- Serves static assets from CDN
- Caches responses globally
- Provides DDoS protection

## Security Checklist

- [ ] All environment variables are set
- [ ] HTTPS is enabled (automatic with Vercel)
- [ ] Auth0 URLs are configured correctly
- [ ] Database RLS policies are enabled
- [ ] Webhook secrets are configured
- [ ] API keys are not exposed in client code
- [ ] Sentry is configured to sanitize sensitive data
- [ ] Rate limiting is enabled
- [ ] Security headers are set (automatic with vercel.json)

## Cost Monitoring

All services used are free tier:
- Vercel: Free (hobby plan)
- Supabase: Free (500MB database, 1GB storage)
- Auth0: Free (7,000 active users)
- Inngest: Free (limited events)
- Upstash: Free (10,000 commands/day)
- Qdrant: Free (1GB cluster)
- E2B: Free tier available
- Resend: Free (100 emails/day)
- Sentry: Free (5,000 errors/month)
- PostHog: Free (1M events/month)

Monitor usage in each service dashboard to avoid overages.

## Support

For deployment issues:
- Check Vercel function logs
- Review Sentry error reports
- Check service status pages
- Consult service documentation

## Next Steps

After successful deployment:
1. Test all features in production
2. Set up monitoring dashboards
3. Configure backup procedures
4. Document any custom configurations
5. Train team on deployment process
