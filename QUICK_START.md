# DevSentinel Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Git

## 1. Clone and Install

```bash
cd devsentinel
npm install
```

## 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local and fill in all required values
# See INFRASTRUCTURE.md for detailed instructions
```

## 3. Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and keys to `.env.local`
3. Run the migration in Supabase SQL Editor:
   - Open `supabase/migrations/001_initial_schema.sql`
   - Copy and paste into SQL Editor
   - Execute

## 4. Auth0 Setup

1. Create an Auth0 account at [auth0.com](https://auth0.com)
2. Create a new "Regular Web Application"
3. Configure:
   - Allowed Callback URLs: `http://localhost:3000/api/auth/callback`
   - Allowed Logout URLs: `http://localhost:3000`
   - Allowed Web Origins: `http://localhost:3000`
4. Enable GitHub social connection
5. Copy credentials to `.env.local`

## 5. Other Services

Set up accounts and get API keys for:

- **Inngest**: [inngest.com](https://inngest.com) - Job queue
- **Upstash**: [upstash.com](https://upstash.com) - Redis
- **Google AI Studio**: [aistudio.google.com](https://aistudio.google.com) - Gemini API
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com) - Claude API
- **E2B**: [e2b.dev](https://e2b.dev) - Code sandboxes
- **Sentry**: [sentry.io](https://sentry.io) - Error tracking
- **PostHog**: [posthog.com](https://posthog.com) - Analytics

## 6. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 7. Verify Setup

The application will:
- ✓ Validate all environment variables on startup
- ✓ Initialize monitoring (Sentry, PostHog)
- ✓ Connect to Supabase
- ✓ Connect to Redis

If any environment variables are missing, you'll see a clear error message.

## Common Commands

```bash
# Development
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Run tests (when implemented)
npm test
```

## Project Structure

```
devsentinel/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Landing page
│   └── providers.tsx      # Client providers
├── lib/                   # Shared libraries
│   ├── config/           # Configuration
│   ├── supabase/         # Database clients
│   ├── redis/            # Cache & rate limiting
│   └── monitoring/       # Sentry & PostHog
├── inngest/              # Background jobs
├── supabase/             # Database migrations
└── middleware.ts         # Auth & rate limiting
```

## Key Files

- **`.env.local`**: Environment variables (create from `.env.example`)
- **`middleware.ts`**: Authentication and rate limiting
- **`lib/config/env.ts`**: Environment validation
- **`lib/supabase/types.ts`**: Database type definitions
- **`INFRASTRUCTURE.md`**: Detailed setup guide

## Troubleshooting

### "Missing required environment variables"
- Check that `.env.local` exists
- Verify all variables are set (no empty values)
- Restart the dev server

### Database connection errors
- Verify Supabase URL and keys
- Check that migration was run
- Verify RLS policies are enabled

### Auth0 login fails
- Check callback URLs are configured
- Verify GitHub connection is enabled
- Check Auth0 credentials in `.env.local`

## Need Help?

- See `INFRASTRUCTURE.md` for detailed setup instructions
- Check `SETUP_COMPLETE.md` for implementation details
- Review the LLD documentation in `devsentinel-docs/`

## Next Steps

Once setup is complete:
1. Test authentication flow
2. Create a test project
3. Start implementing features (see `tasks.md`)

---

**Ready to build!** 🚀
