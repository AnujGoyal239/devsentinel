/**
 * Auth0 Dynamic API Route Handler
 * 
 * Handles all Auth0 authentication routes:
 * - /api/auth/login - Initiates GitHub OAuth flow
 * - /api/auth/logout - Logs out user and clears session
 * - /api/auth/callback - OAuth callback handler
 * - /api/auth/me - Returns current user session
 */

import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';

export const GET = handleAuth({
  login: handleLogin({
    authorizationParams: {
      // Request GitHub OAuth with read scope initially
      // Scope escalation to repo:write happens on first Auto-Fix
      scope: 'openid profile email read:user repo',
      connection: 'github',
    },
    returnTo: '/dashboard',
  }),
});
