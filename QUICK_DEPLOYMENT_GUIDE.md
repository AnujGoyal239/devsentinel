# DevSentinel - Quick Deployment Guide

Complete this guide to deploy DevSentinel in ~2-3 hours.

---

## 📋 Step 1: Set Up Required Services

### 1.1 Auth0 (Authentication) - 15 minutes

**Sign up:** https://auth0.com

1. Create account → Create Application → "Regular Web Application"
2. Name: "DevSentinel"
3. Go to Settings:
   - Copy `Domain` → Save as `AUTH0_ISSUER_BASE_URL` (add https://)
   - Copy `Client ID` → Save as `AUTH0_CLIENT_ID`
   - Copy `Client Secret` → Save as `AUTH0_CLIENT_SECRET`
4. Generate secret:
   ```bash
   openssl rand -hex 32
   ```
   Save as `AUTH0_SECRET`
5. Connections → Social → Enable GitHub
   - Request scopes: `user:email`, `read:user`, `repo`
6. **Note:** You'll update callback URLs after Vercel deployment

**Environment Variables:**
```
AUTH0_SECRET=<generated-secret>
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=<client-id>
AUTH0_CLIENT_SECRET=<client-secret>
```

---

### 1.2 Supabase (Database) - 20 minutes

**Sign up:** https://supabase.com

1. Create account → New Project
2. Choose organization and region (closest to users)
3. Set database password (save securely)
4. Wait for project creation (~2 minutes)
5. Go to Settings → API:
   - Copy `Project URL` → Save as `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `anon/public` key → Save as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `service_role` key → Save as `SUPABASE_SERVICE_ROLE_KEY`
6. Go to SQL Editor → Run each migration file:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_add_user_email.sql`
   - `supabase/migrations/003_create_prd_storage.sql`
   - `supabase/migrations/004_add_sandbox_id_to_fix_jobs.sql`
   - `supabase/migrations/005_add_email_notifications.sql`
   - `supabase/migrations/005_create_report_shares_table.sql`
   - `supabase/migrations/006_add_user_deletion_field.sql`
   - `supabase/migrations/006_create_finding_comments_table.sql`
   - `supabase/migrations/007_add_webhook_fields.sql`
   - `supabase/migrations/008_create_custom_rules_table.sql`
   - `supabase/migrations/009_create_api_keys_table.sql`
7. Go to Storage → Create bucket: `documents` (Private)

**Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL=<project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

---

### 1.3 Groq (AI Analysis) - 5 minutes

**Sign up:** https://console.groq.com

1. Create account
2. Go to API Keys → Create API Key
3. Copy key → Save as `GROQ_API_KEY`

**Environment Variables:**
```
GROQ_API_KEY=<api-key>
```

---

### 1.4 E2B (Code Sandboxes) - 5 minutes

**Sign up:** https://e2b.dev

1. Create account
2. Go to API Keys
3. Copy key → Save as `E2B_API_KEY`

**Environment Variables:**
```
E2B_API_KEY=<api-key>
```

---

### 1.5 Jina AI (Embeddings) - 5 minutes

**Sign up:** https://jina.ai

1. Create account
2. Go to API Keys → Create Key
3. Copy key → Save as `JINA_API_KEY`

**Environment Variables:**
```
JINA_API_KEY=<api-key>
```

---

### 1.6 Qdrant (Vector Search) - 10 minutes

**Sign up:** https://qdrant.tech

1. Create account
2. Create Cluster → Free tier (1GB)
3. Wait for cluster creation (~2 minutes)
4. Go to Cluster Details:
   - Copy `Cluster URL` → Save as `QDRANT_URL`
   - Copy `API Key` → Save as `QDRANT_API_KEY`

**Environment Variables:**
```
QDRANT_URL=<cluster-url>
QDRANT_API_KEY=<api-key>
```

---

### 1.7 Upstash Redis (Rate Limiting) - 5 minutes

**Sign up:** https://upstash.com

1. Create account
2. Create Database → Redis → Free tier
3. Go to Database Details:
   - Copy `REST URL` → Save as `UPSTASH_REDIS_REST_URL`
   - Copy `REST Token` → Save as `UPSTASH_REDIS_REST_TOKEN`

**Environment Variables:**
```
UPSTASH_REDIS_REST_URL=<rest-url>
UPSTASH_REDIS_REST_TOKEN=<rest-token>
```

---

### 1.8 Inngest (Background Jobs) - 10 minutes

**Sign up:** https://inngest.com

1. Create account
2. Create Project
3. Go to Settings → Keys:
   - Copy `Event Key` → Save as `INNGEST_EVENT_KEY`
   - Copy `Signing Key` → Save as `INNGEST_SIGNING_KEY`
4. **Note:** You'll configure webhook URL after Vercel deployment

**Environment Variables:**
```
INNGEST_EVENT_KEY=<event-key>
INNGEST_SIGNING_KEY=<signing-key>
```

---

### 1.9 Resend (Email) - 10 minutes

**Sign up:** https://resend.com

1. Create account
2. Add and verify your domain (or use resend.dev for testing)
3. Go to API Keys → Create API Key
4. Copy key → Save as `RESEND_API_KEY`
5. Set from email → Save as `RESEND_FROM_EMAIL`

**Environment Variables:**
```
RESEND_API_KEY=<api-key>
RESEND_FROM_EMAIL=notifications@yourdomain.com
```

---

### 1.10 Sentry (Error Tracking) - 10 minutes

**Sign up:** https://sentry.io

1. Create account
2. Create Project → Next.js
3. Copy `DSN` → Save as `SENTRY_DSN`

**Environment Variables:**
```
SENTRY_DSN=<dsn>
```

---

### 1.11 PostHog (Analytics) - 5 minutes

**Sign up:** https://posthog.com

1. Create account
2. Create Project
3. Go to Project Settings:
   - Copy `Project API Key` → Save as `NEXT_PUBLIC_POSTHOG_KEY`
   - Use `https://app.posthog.com` as `NEXT_PUBLIC_POSTHOG_HOST`

**Environment Variables:**
```
NEXT_PUBLIC_POSTHOG_KEY=<api-key>
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

### 1.12 GitHub Webhook Secret - 1 minute

Generate a secret for webhook verification:

```bash
openssl rand -hex 32
```

Save as `GITHUB_WEBHOOK_SECRET`

**Environment Variables:**
```
GITHUB_WEBHOOK_SECRET=<generated-secret>
```

---

## 📋 Step 2: Deploy to Vercel

### 2.1 Connect Repository - 5 minutes

1. Go to https://vercel.com
2. Sign up / Log in with GitHub
3. Click "New Project"
4. Import repository: `https://github.com/AnujGoyal239/devsentinel.git`
5. Configure:
   - **Root Directory:** `devsentinel`
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

### 2.2 Add Environment Variables - 10 minutes

In Vercel project settings, add ALL environment variables:

```env
# Auth0
AUTH0_SECRET=<your-value>
AUTH0_BASE_URL=https://your-project.vercel.app
AUTH0_ISSUER_BASE_URL=<your-value>
AUTH0_CLIENT_ID=<your-value>
AUTH0_CLIENT_SECRET=<your-value>

# Application
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<your-value>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-value>
SUPABASE_SERVICE_ROLE_KEY=<your-value>

# AI Models
GROQ_API_KEY=<your-value>

# Infrastructure
E2B_API_KEY=<your-value>
JINA_API_KEY=<your-value>
QDRANT_URL=<your-value>
QDRANT_API_KEY=<your-value>
UPSTASH_REDIS_REST_URL=<your-value>
UPSTASH_REDIS_REST_TOKEN=<your-value>
INNGEST_SIGNING_KEY=<your-value>
INNGEST_EVENT_KEY=<your-value>
GITHUB_WEBHOOK_SECRET=<your-value>

# Integrations
RESEND_API_KEY=<your-value>
RESEND_FROM_EMAIL=<your-value>

# Monitoring
SENTRY_DSN=<your-value>
NEXT_PUBLIC_POSTHOG_KEY=<your-value>
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

**Important:** Replace `https://your-project.vercel.app` with your actual Vercel URL after deployment.

### 2.3 Deploy - 5 minutes

1. Click "Deploy"
2. Wait for build to complete (~3-5 minutes)
3. Copy your deployment URL (e.g., `https://devsentinel-xyz.vercel.app`)

---

## 📋 Step 3: Post-Deployment Configuration

### 3.1 Update Auth0 URLs - 2 minutes

1. Go to Auth0 Dashboard → Applications → DevSentinel → Settings
2. Update:
   - **Allowed Callback URLs:** `https://your-vercel-url.vercel.app/api/auth/callback`
   - **Allowed Logout URLs:** `https://your-vercel-url.vercel.app`
   - **Allowed Web Origins:** `https://your-vercel-url.vercel.app`
3. Click "Save Changes"

### 3.2 Update Vercel Environment Variables - 2 minutes

1. Go to Vercel → Project Settings → Environment Variables
2. Update:
   - `AUTH0_BASE_URL` → `https://your-vercel-url.vercel.app`
   - `NEXT_PUBLIC_APP_URL` → `https://your-vercel-url.vercel.app`
3. Redeploy (Deployments → ... → Redeploy)

### 3.3 Configure Inngest Webhook - 2 minutes

1. Go to Inngest Dashboard → Settings
2. Add webhook URL: `https://your-vercel-url.vercel.app/api/inngest`
3. Verify connection (should show green checkmark)

### 3.4 Test Health Check - 1 minute

Visit: `https://your-vercel-url.vercel.app/api/health`

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-09T...",
  "services": {
    "redis": "connected"
  }
}
```

### 3.5 Test Complete User Flow - 10 minutes

1. Visit your Vercel URL
2. Click "Sign In with GitHub"
3. Authorize the application
4. Create a new project
5. Add a GitHub repository URL
6. Run analysis
7. View results
8. (Optional) Trigger auto-fix

---

## 📋 Step 4: Optional - Set Up GitHub Webhooks

For automatic analysis on push events:

1. Go to your GitHub repository → Settings → Webhooks
2. Click "Add webhook"
3. Configure:
   - **Payload URL:** `https://your-vercel-url.vercel.app/api/webhooks/github`
   - **Content type:** `application/json`
   - **Secret:** Your `GITHUB_WEBHOOK_SECRET` value
   - **Events:** Select "Push", "Pull request", "Release"
4. Click "Add webhook"

---

## ✅ Deployment Complete!

Your DevSentinel platform is now live at: `https://your-vercel-url.vercel.app`

### Next Steps:

1. **Monitor Performance**
   - Check Sentry for errors
   - Review PostHog analytics
   - Monitor Vercel function logs

2. **Set Up Alerts**
   - Configure Sentry alerts (>1% error rate)
   - Set up uptime monitoring (UptimeRobot, Pingdom)

3. **Custom Domain (Optional)**
   - Go to Vercel → Project Settings → Domains
   - Add your custom domain
   - Update Auth0 URLs with custom domain

4. **Backup Strategy**
   - Supabase automatic backups enabled (7-day retention)
   - Document recovery procedures

---

## 🆘 Troubleshooting

### Build Fails
- Check all environment variables are set correctly
- Verify no typos in variable names
- Check Vercel build logs for specific errors

### Authentication Not Working
- Verify Auth0 callback URLs match Vercel URL exactly
- Check `AUTH0_SECRET` is set
- Ensure GitHub OAuth is enabled in Auth0

### Health Check Fails
- Check Upstash Redis connection
- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Check Vercel function logs

### Analysis Not Starting
- Verify Inngest webhook is configured
- Check `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY`
- Review Inngest dashboard for failed events

---

## 📞 Support

- **Deployment Guide:** See `DEPLOYMENT.md` for detailed instructions
- **User Guide:** See `docs/user-guide.md`
- **Repository:** https://github.com/AnujGoyal239/devsentinel.git

---

## 🎉 Congratulations!

You've successfully deployed DevSentinel! The platform is now ready to analyze repositories and create automated fixes.

**Total Setup Time:** ~2-3 hours
**Monthly Cost:** $0 (using free tiers)
