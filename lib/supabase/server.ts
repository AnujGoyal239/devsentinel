/**
 * Supabase Server Client
 * 
 * Uses the service role key which bypasses Row-Level Security.
 * ONLY use this in server-side code (API routes, Inngest functions).
 * NEVER expose this client to the browser.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
  );
}

/**
 * Server-side Supabase client with service role key.
 * Bypasses RLS - use with caution and always filter by user_id manually.
 * 
 * Use this in:
 * - API routes
 * - Inngest functions
 * - Server-side operations
 */
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Create a server-side Supabase client
 * This is the recommended way to use Supabase in server components
 */
export function createServerClient() {
  return supabase;
}
