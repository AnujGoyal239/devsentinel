/**
 * API Key Management
 * 
 * Handles:
 * - Generating secure random API keys
 * - Hashing API keys before storage (bcrypt)
 * - Validating API keys during authentication
 * - Managing API key lifecycle (create, list, revoke)
 */

import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { createServerClient } from '../supabase/server';

/**
 * API key format: ds_<32 bytes base64url>
 * Example: ds_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
 */
const API_KEY_PREFIX = 'ds_';
const API_KEY_BYTES = 32;
const BCRYPT_ROUNDS = 10;

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string; // Full plaintext key (only returned once upon creation)
}

/**
 * Generate a cryptographically secure random API key
 * Format: ds_<base64url-encoded-random-bytes>
 */
export function generateApiKey(): string {
  const randomBytesBuffer = randomBytes(API_KEY_BYTES);
  const base64url = randomBytesBuffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${API_KEY_PREFIX}${base64url}`;
}

/**
 * Hash an API key using bcrypt
 * Used before storing in database
 */
export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, BCRYPT_ROUNDS);
}

/**
 * Verify an API key against its hash
 * Used during authentication
 */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}

/**
 * Extract the prefix from an API key for display
 * Shows first 8 characters (e.g., "ds_abc12...")
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, 8);
}

/**
 * Create a new API key for a user
 * Returns the full key (only time it's visible)
 */
export async function createApiKey(
  userId: string,
  name: string
): Promise<ApiKeyWithSecret> {
  const supabase = createServerClient();

  // Generate the API key
  const key = generateApiKey();
  const keyHash = await hashApiKey(key);
  const keyPrefix = getKeyPrefix(key);

  // Store in database
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: userId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating API key:', error);
    throw new Error('Failed to create API key');
  }

  // Return the key with the plaintext secret (only time it's visible)
  return {
    ...data,
    key,
  };
}

/**
 * List all API keys for a user
 * Does not include the actual key values (only metadata)
 */
export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, user_id, name, key_prefix, last_used_at, created_at, revoked_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing API keys:', error);
    throw new Error('Failed to list API keys');
  }

  return data || [];
}

/**
 * Revoke an API key (soft delete)
 * Sets revoked_at timestamp
 */
export async function revokeApiKey(keyId: string, userId: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error revoking API key:', error);
    throw new Error('Failed to revoke API key');
  }
}

/**
 * Authenticate a request using an API key
 * Returns the user ID if valid, null otherwise
 */
export async function authenticateApiKey(key: string): Promise<string | null> {
  if (!key || !key.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  const supabase = createServerClient();

  // Get all active API keys (not revoked)
  // We need to check all keys because we can't query by hash directly
  const { data: apiKeys, error } = await supabase
    .from('api_keys')
    .select('id, user_id, key_hash')
    .is('revoked_at', null);

  if (error || !apiKeys || apiKeys.length === 0) {
    return null;
  }

  // Check each key hash until we find a match
  for (const apiKey of apiKeys) {
    const isValid = await verifyApiKey(key, apiKey.key_hash);
    
    if (isValid) {
      // Update last_used_at timestamp
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', apiKey.id);

      return apiKey.user_id;
    }
  }

  return null;
}

/**
 * Validate API key format
 * Checks if the key matches the expected format
 */
export function isValidApiKeyFormat(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }

  // Check prefix
  if (!key.startsWith(API_KEY_PREFIX)) {
    return false;
  }

  // Check length (prefix + base64url encoded 32 bytes)
  // Base64url encoding of 32 bytes = 43 characters (no padding)
  const expectedLength = API_KEY_PREFIX.length + 43;
  if (key.length !== expectedLength) {
    return false;
  }

  // Check that the rest is valid base64url
  const keyBody = key.substring(API_KEY_PREFIX.length);
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  return base64urlRegex.test(keyBody);
}
