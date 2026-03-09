/**
 * User Session Management
 * 
 * Handles:
 * - Getting current authenticated user
 * - Creating/updating user records in Supabase on first login
 * - Storing GitHub user info and tokens
 */

import { getSession as getAuth0Session } from '@auth0/nextjs-auth0';
import { createServerClient } from '../supabase/server';
import { encrypt } from './encryption';

export interface UserSession {
  id: string;
  github_id: string;
  username: string;
  avatar_url: string | null;
  email: string | null;
}

/**
 * Get the current authenticated user session
 * Returns null if not authenticated
 */
export async function getSession(): Promise<UserSession | null> {
  try {
    const session = await getAuth0Session();
    
    if (!session || !session.user) {
      return null;
    }

    return {
      id: session.user.sub,
      github_id: session.user.sub.split('|')[1], // Auth0 format: "github|123456"
      username: session.user.nickname || session.user.name,
      avatar_url: session.user.picture || null,
      email: session.user.email || null,
    };
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Get current user with full database record
 * Creates user record if it doesn't exist (first login)
 */
export async function getCurrentUser() {
  const session = await getSession();
  
  if (!session) {
    return null;
  }

  const supabase = createServerClient();

  // Check if user exists in database
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('github_id', session.github_id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = not found, which is expected for first login
    console.error('Error fetching user:', fetchError);
    throw new Error('Failed to fetch user');
  }

  // User exists, return it
  if (existingUser) {
    return existingUser;
  }

  // First login - create user record
  return await createUserRecord(session);
}

/**
 * Create a new user record in Supabase
 * Called on first login via Auth0
 */
async function createUserRecord(session: UserSession) {
  const supabase = createServerClient();

  // Get GitHub access token from Auth0 session
  const auth0Session = await getAuth0Session();
  const githubToken = auth0Session?.accessToken;

  if (!githubToken) {
    throw new Error('No GitHub access token available');
  }

  // Encrypt the GitHub token before storing
  const encryptedToken = encrypt(githubToken);

  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({
      github_id: session.github_id,
      username: session.username,
      avatar_url: session.avatar_url,
      email: session.email,
      github_token: encryptedToken,
    })
    .select()
    .single();

  if (createError) {
    console.error('Error creating user:', createError);
    throw new Error('Failed to create user record');
  }

  return newUser;
}

/**
 * Update user's GitHub token
 * Called when scope escalation occurs (repo:read -> repo:write)
 */
export async function updateGitHubToken(userId: string, newToken: string) {
  const supabase = createServerClient();
  const encryptedToken = encrypt(newToken);

  const { error } = await supabase
    .from('users')
    .update({ github_token: encryptedToken })
    .eq('id', userId);

  if (error) {
    console.error('Error updating GitHub token:', error);
    throw new Error('Failed to update GitHub token');
  }
}

/**
 * Get decrypted GitHub token for a user
 * Used when making GitHub API calls
 */
export async function getGitHubToken(userId: string): Promise<string | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('users')
    .select('github_token')
    .eq('id', userId)
    .single();

  if (error || !data?.github_token) {
    return null;
  }

  // Decrypt the token before returning
  const { decrypt } = await import('./encryption');
  return decrypt(data.github_token);
}
