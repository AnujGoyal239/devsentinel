/**
 * Environment Variable Validation Utility
 * 
 * Validates all required environment variables at application startup.
 * Throws an error if any required variable is missing (fail-fast).
 */

interface EnvConfig {
  // Auth0
  AUTH0_SECRET: string;
  AUTH0_BASE_URL: string;
  AUTH0_ISSUER_BASE_URL: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // AI Models
  GROQ_API_KEY: string;

  // Infrastructure
  E2B_API_KEY: string;
  JINA_API_KEY: string;
  QDRANT_URL: string;
  QDRANT_API_KEY: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  INNGEST_SIGNING_KEY: string;
  INNGEST_EVENT_KEY: string;

  // Integrations
  RESEND_API_KEY: string;

  // Monitoring
  SENTRY_DSN: string;
  NEXT_PUBLIC_POSTHOG_KEY: string;
  NEXT_PUBLIC_POSTHOG_HOST: string;
}

const requiredEnvVars: (keyof EnvConfig)[] = [
  // Auth0
  'AUTH0_SECRET',
  'AUTH0_BASE_URL',
  'AUTH0_ISSUER_BASE_URL',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET',

  // Supabase
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',

  // AI Models
  'GROQ_API_KEY',

  // Infrastructure
  'E2B_API_KEY',
  'JINA_API_KEY',
  'QDRANT_URL',
  'QDRANT_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'INNGEST_SIGNING_KEY',
  'INNGEST_EVENT_KEY',

  // Integrations
  'RESEND_API_KEY',

  // Monitoring
  'SENTRY_DSN',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_POSTHOG_HOST',
];

/**
 * Validates that all required environment variables are present.
 * Throws an error with a descriptive message if any are missing.
 */
export function validateEnv(): EnvConfig {
  const missing: string[] = [];

  for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}\n\n` +
      `Please set these variables in your .env.local file or deployment environment.`
    );
  }

  return process.env as unknown as EnvConfig;
}

/**
 * Validated environment configuration.
 * Call this at application startup to ensure all required variables are present.
 */
export const env = validateEnv();
