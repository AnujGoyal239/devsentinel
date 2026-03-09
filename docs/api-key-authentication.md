# API Key Authentication

## Overview

API keys enable programmatic access to the DevSentinel platform for CI/CD pipelines and automation tools. API keys are an alternative to JWT authentication for machine-to-machine communication.

## Security Features

- **Secure Generation**: 32-byte cryptographically secure random keys
- **Hashed Storage**: Keys are hashed with bcrypt before storage (never stored in plaintext)
- **One-Time Display**: Full key is only shown once upon creation
- **Prefix Identification**: Keys use `ds_` prefix for easy identification
- **Revocation Support**: Keys can be revoked (soft delete) at any time
- **Usage Tracking**: Last used timestamp for audit trail

## API Key Format

```
ds_<base64url-encoded-32-bytes>
```

Example:
```
ds_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

## API Endpoints

### Create API Key

**POST** `/api/user/api-keys`

Creates a new API key for the authenticated user.

**Request Body:**
```json
{
  "name": "GitHub Actions"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "GitHub Actions",
    "key": "ds_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
    "key_prefix": "ds_abc12",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Important:** The `key` field is only returned once. Store it securely.

**Validation Rules:**
- Name is required
- Name must be 1-100 characters
- Name can only contain letters, numbers, spaces, hyphens, and underscores
- Name must be unique per user

### List API Keys

**GET** `/api/user/api-keys`

Lists all API keys for the authenticated user.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "GitHub Actions",
      "key_prefix": "ds_abc12",
      "last_used_at": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-01T00:00:00Z",
      "revoked_at": null,
      "is_active": true
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Jenkins",
      "key_prefix": "ds_def34",
      "last_used_at": null,
      "created_at": "2024-01-10T00:00:00Z",
      "revoked_at": "2024-01-20T00:00:00Z",
      "is_active": false
    }
  ]
}
```

### Revoke API Key

**DELETE** `/api/user/api-keys/:keyId`

Revokes an API key (soft delete). The key will no longer authenticate requests.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

## Using API Keys

### Authentication Header

Include the API key in the `Authorization` header with the `Bearer` scheme:

```bash
curl -H "Authorization: Bearer ds_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz" \
  https://api.devsentinel.com/api/projects
```

### Example: Trigger Analysis from CI/CD

```bash
#!/bin/bash

# Store API key in CI/CD secrets
API_KEY="${DEVSENTINEL_API_KEY}"
PROJECT_ID="your-project-id"

# Trigger analysis
curl -X POST \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  "https://api.devsentinel.com/api/projects/${PROJECT_ID}/analyse"
```

### Example: GitHub Actions

```yaml
name: DevSentinel Analysis

on:
  push:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger DevSentinel Analysis
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.DEVSENTINEL_API_KEY }}" \
            -H "Content-Type: application/json" \
            "https://api.devsentinel.com/api/projects/${{ secrets.DEVSENTINEL_PROJECT_ID }}/analyse"
```

## Rate Limiting

API key requests are subject to the same rate limits as JWT-authenticated requests:
- 100 requests per minute per user
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Unix timestamp when the window resets

## Security Best Practices

1. **Store Securely**: Never commit API keys to version control
2. **Use CI/CD Secrets**: Store keys in your CI/CD platform's secret management
3. **Rotate Regularly**: Create new keys and revoke old ones periodically
4. **Descriptive Names**: Use clear names to identify where each key is used
5. **Revoke Unused Keys**: Revoke keys that are no longer needed
6. **Monitor Usage**: Check `last_used_at` timestamps to identify unused keys

## Database Schema

```sql
CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  key_prefix   TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  
  CONSTRAINT unique_user_key_name UNIQUE (user_id, name)
);
```

## Implementation Details

### Key Generation

- Uses Node.js `crypto.randomBytes()` for cryptographically secure random generation
- 32 bytes of entropy (256 bits)
- Base64url encoding (URL-safe, no padding)

### Hashing

- bcrypt with 10 rounds (cost factor)
- Includes salt automatically
- Constant-time comparison to prevent timing attacks

### Authentication Flow

1. Extract `Authorization: Bearer <key>` header
2. Validate key format (prefix, length, characters)
3. Query active API keys from database
4. Compare provided key against each hash using bcrypt
5. Update `last_used_at` timestamp on successful match
6. Return user ID for authorization

### Middleware Integration

The authentication middleware checks for API keys before falling back to JWT:

```typescript
// Check for API key first
const authHeader = request.headers.get('authorization');
if (authHeader?.startsWith('Bearer ')) {
  const token = authHeader.substring(7);
  if (isValidApiKeyFormat(token)) {
    userId = await authenticateApiKey(token);
  }
}

// Fall back to JWT if no API key
if (!userId) {
  const session = await getSession(request);
  userId = session?.user?.sub;
}
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `DUPLICATE_NAME` | 409 | API key name already exists |
| `INVALID_KEY_ID` | 400 | Invalid UUID format for key ID |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Testing

Run the test suite:

```bash
# Unit tests
npm test -- lib/auth/__tests__/api-keys.test.ts --run

# Integration tests
npm test -- app/api/user/api-keys/__tests__/route.test.ts --run
```

## Migration

Apply the database migration:

```bash
# Using Supabase CLI
supabase db push

# Or manually apply
psql -f supabase/migrations/009_create_api_keys_table.sql
```
