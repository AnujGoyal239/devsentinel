/**
 * Unit Tests for API Key Management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase before importing api-keys
vi.mock('../../supabase/server', () => ({
  createServerClient: vi.fn(),
}));

import {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  getKeyPrefix,
  isValidApiKeyFormat,
} from '../api-keys';

describe('API Key Generation', () => {
  it('should generate a key with correct prefix', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^ds_/);
  });

  it('should generate keys with correct length', () => {
    const key = generateApiKey();
    // ds_ (3) + base64url(32 bytes) = 3 + 43 = 46 characters
    expect(key.length).toBe(46);
  });

  it('should generate unique keys', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
  });

  it('should generate keys with valid base64url characters', () => {
    const key = generateApiKey();
    const keyBody = key.substring(3); // Remove ds_ prefix
    expect(keyBody).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('API Key Hashing', () => {
  it('should hash a key', async () => {
    const key = generateApiKey();
    const hash = await hashApiKey(key);
    
    expect(hash).toBeDefined();
    expect(hash).not.toBe(key);
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should produce different hashes for the same key', async () => {
    const key = generateApiKey();
    const hash1 = await hashApiKey(key);
    const hash2 = await hashApiKey(key);
    
    // bcrypt includes a salt, so hashes should be different
    expect(hash1).not.toBe(hash2);
  });

  it('should verify correct key against hash', async () => {
    const key = generateApiKey();
    const hash = await hashApiKey(key);
    
    const isValid = await verifyApiKey(key, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect key against hash', async () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    const hash = await hashApiKey(key1);
    
    const isValid = await verifyApiKey(key2, hash);
    expect(isValid).toBe(false);
  });
});

describe('API Key Prefix', () => {
  it('should extract correct prefix', () => {
    const key = 'ds_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
    const prefix = getKeyPrefix(key);
    expect(prefix).toBe('ds_abc12');
  });

  it('should handle short keys', () => {
    const key = 'ds_abc';
    const prefix = getKeyPrefix(key);
    expect(prefix).toBe('ds_abc');
  });
});

describe('API Key Format Validation', () => {
  it('should accept valid API key format', () => {
    const key = generateApiKey();
    expect(isValidApiKeyFormat(key)).toBe(true);
  });

  it('should reject key without prefix', () => {
    const key = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
    expect(isValidApiKeyFormat(key)).toBe(false);
  });

  it('should reject key with wrong prefix', () => {
    const key = 'api_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
    expect(isValidApiKeyFormat(key)).toBe(false);
  });

  it('should reject key with invalid characters', () => {
    const key = 'ds_abc123def456ghi789jkl012mno345pqr678stu901vwx234y$';
    expect(isValidApiKeyFormat(key)).toBe(false);
  });

  it('should reject key with wrong length', () => {
    const key = 'ds_abc123';
    expect(isValidApiKeyFormat(key)).toBe(false);
  });

  it('should reject null or undefined', () => {
    expect(isValidApiKeyFormat(null as any)).toBe(false);
    expect(isValidApiKeyFormat(undefined as any)).toBe(false);
  });

  it('should reject non-string values', () => {
    expect(isValidApiKeyFormat(123 as any)).toBe(false);
    expect(isValidApiKeyFormat({} as any)).toBe(false);
    expect(isValidApiKeyFormat([] as any)).toBe(false);
  });
});

describe('API Key Security Properties', () => {
  it('should not contain predictable patterns', () => {
    const keys = Array.from({ length: 100 }, () => generateApiKey());
    
    // Check that no two keys share the same suffix
    const suffixes = keys.map(k => k.substring(k.length - 10));
    const uniqueSuffixes = new Set(suffixes);
    expect(uniqueSuffixes.size).toBe(100);
  });

  it('should have high entropy', () => {
    const key = generateApiKey();
    const keyBody = key.substring(3);
    
    // Count unique characters
    const uniqueChars = new Set(keyBody.split(''));
    
    // Should have at least 20 unique characters in 43-char string
    expect(uniqueChars.size).toBeGreaterThanOrEqual(20);
  });

  it('should be resistant to timing attacks via bcrypt', async () => {
    const key = generateApiKey();
    const hash = await hashApiKey(key);
    
    // Measure time for correct key
    const start1 = Date.now();
    await verifyApiKey(key, hash);
    const time1 = Date.now() - start1;
    
    // Measure time for incorrect key
    const wrongKey = generateApiKey();
    const start2 = Date.now();
    await verifyApiKey(wrongKey, hash);
    const time2 = Date.now() - start2;
    
    // Times should be similar (within 50ms) due to bcrypt's constant-time comparison
    // This is a weak test but demonstrates the concept
    expect(Math.abs(time1 - time2)).toBeLessThan(50);
  });
});
