/**
 * GitHub Token Encryption
 * 
 * Handles secure encryption/decryption of GitHub OAuth tokens
 * Uses AES-256-GCM for encryption at rest
 * 
 * Security principles:
 * - Tokens encrypted before storage in Supabase
 * - Tokens never returned in API responses
 * - Tokens never logged
 * - Tokens decrypted in memory only when needed
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Get encryption key from environment
 * Uses AUTH0_SECRET as the base key material
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH0_SECRET;
  
  if (!secret) {
    throw new Error('AUTH0_SECRET environment variable is required for token encryption');
  }

  // Derive a 32-byte key from the secret
  // In production, consider using a dedicated encryption key
  return Buffer.from(secret.slice(0, 32).padEnd(32, '0'));
}

/**
 * Encrypt a GitHub token
 * Returns base64-encoded encrypted string with IV and auth tag
 */
export function encrypt(token: string): string {
  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encryptedData
    const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    
    return Buffer.from(result).toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt a GitHub token
 * Takes base64-encoded encrypted string and returns plaintext token
 */
export function decrypt(encryptedToken: string): string {
  try {
    const key = getEncryptionKey();
    
    // Decode from base64
    const decoded = Buffer.from(encryptedToken, 'base64').toString('utf8');
    const parts = decoded.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Check if a token has the required GitHub scope
 * Used to verify if scope escalation is needed
 */
export async function hasGitHubScope(token: string, requiredScope: string): Promise<boolean> {
  try {
    // Make a request to GitHub API to check token scopes
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    // GitHub returns scopes in the X-OAuth-Scopes header
    const scopes = response.headers.get('X-OAuth-Scopes');
    
    if (!scopes) {
      return false;
    }
    
    const scopeList = scopes.split(',').map(s => s.trim());
    return scopeList.includes(requiredScope);
  } catch (error) {
    console.error('Error checking GitHub scope:', error);
    return false;
  }
}

/**
 * Trigger OAuth scope escalation
 * Redirects user to Auth0 to request additional permissions
 */
export function triggerScopeEscalation(currentUrl: string): string {
  const params = new URLSearchParams({
    scope: 'openid profile email read:user repo',
    connection: 'github',
    prompt: 'consent', // Force re-authorization
    returnTo: currentUrl,
  });
  
  return `/api/auth/login?${params.toString()}`;
}
