# API Response Consistency and Error Handling

This document describes the consistent API response format and error handling implemented across the DevSentinel platform.

## Overview

All API routes now follow a consistent response format with proper HTTP status codes, descriptive error messages, and graceful error handling for external service failures.

## Response Format

### Success Responses

All successful responses follow this format:

```typescript
{
  data: T  // The actual response data
}
```

**Status Codes:**
- `200 OK` - Successful GET requests
- `201 Created` - Successful POST requests that create resources

### Error Responses

All error responses follow this format:

```typescript
{
  error: string,      // Human-readable error message
  code: string,       // Machine-readable error code
  request_id: string  // Correlation ID for debugging
}
```

**Status Codes:**
- `400 Bad Request` - Validation errors, invalid input
- `401 Unauthorized` - Authentication required or failed
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded (includes `retry_after` field)
- `500 Internal Server Error` - Server errors (generic message in production)

## API Helper Functions

### `createApiResponse(data, status, correlationId)`

Creates a consistent success response.

```typescript
return createApiResponse(project, 201, correlationId);
```

### `ApiErrors` Object

Provides standard error responses:

```typescript
// 400 Bad Request
ApiErrors.badRequest('Invalid input', correlationId)

// 401 Unauthorized
ApiErrors.unauthorized(undefined, correlationId)

// 403 Forbidden
ApiErrors.forbidden('Insufficient permissions', correlationId)

// 404 Not Found
ApiErrors.notFound('Resource not found', correlationId)

// 429 Too Many Requests
ApiErrors.tooManyRequests(60, correlationId)

// 500 Internal Server Error
ApiErrors.internalError(correlationId)
```

## Error Handling by Service

### GitHub API Errors

The GitHub client (`lib/github/client.ts`) implements:

- **Exponential backoff retry** - Up to 3 retries with exponential backoff for rate limit errors
- **Custom error type** - `GitHubApiError` with status code and rate limit flag
- **Descriptive messages**:
  - Rate limit: "GitHub API rate limit exceeded. Please try again later."
  - Auth failure: "GitHub authentication failed. Please reconnect your GitHub account."
  - Not found: "Repository {owner}/{repo} not found or you don't have access."

**Usage:**
```typescript
try {
  const tree = await fetchRepoTree(owner, repo, branch, token);
} catch (error) {
  if (error instanceof GitHubApiError) {
    if (error.isRateLimit) {
      return ApiErrors.tooManyRequests(60, correlationId);
    }
    if (error.statusCode === 401) {
      return ApiErrors.unauthorized(error.message, correlationId);
    }
  }
}
```

### Gemini API Errors with Groq Fallback

The Gemini client (`lib/ai/gemini.ts`) implements:

- **Automatic fallback to Groq** - If Gemini fails, automatically retries with Groq
- **Custom error type** - `AIApiError` with provider and rate limit flag
- **Graceful degradation** - Continues operation even if AI services are degraded

**Usage:**
```typescript
try {
  const requirements = await extractRequirements(prdText);
} catch (error) {
  if (error instanceof AIApiError) {
    logger.error('AI service failed', { provider: error.provider });
    return ApiErrors.internalError(correlationId);
  }
}
```

### E2B Sandbox Errors

The E2B client (`lib/e2b/client.ts`) implements:

- **Custom error type** - `E2BSandboxError` with operation type
- **Descriptive messages** for each operation:
  - Create: "Failed to create E2B sandbox. This may be due to API quota limits or service unavailability."
  - Execute: "Failed to execute command in sandbox"
  - Read/Write: "Failed to read/write file {path}"
  - Clone: "Failed to clone repository {repoUrl}"

**Usage:**
```typescript
try {
  const sandbox = await createSandbox();
} catch (error) {
  if (error instanceof E2BSandboxError) {
    logger.error('Sandbox operation failed', { operation: error.operation });
    return ApiErrors.internalError(correlationId);
  }
}
```

### Database Errors

The database error handler (`lib/supabase/errors.ts`) implements:

- **Custom error type** - `DatabaseError` with code and connection error flag
- **PostgreSQL error code mapping**:
  - `PGRST116` → NOT_FOUND
  - `23505` → DUPLICATE_RECORD
  - `23503` → FOREIGN_KEY_VIOLATION
  - `23514` → CONSTRAINT_VIOLATION
  - `42501` → PERMISSION_DENIED
  - Connection errors → CONNECTION_ERROR

**Usage:**
```typescript
try {
  const { data, error } = await supabase.from('projects').select();
  if (error) {
    const dbError = handleDatabaseError(error);
    if (dbError.code === 'NOT_FOUND') {
      return ApiErrors.notFound(dbError.message, correlationId);
    }
    if (dbError.isConnectionError) {
      return ApiErrors.internalError(correlationId);
    }
  }
} catch (error) {
  return ApiErrors.internalError(correlationId);
}
```

## Security Considerations

### Production Error Messages

In production, internal error details are never exposed:

```typescript
const isProduction = process.env.NODE_ENV === 'production';
const errorMessage = isProduction
  ? 'An internal server error occurred. Please try again later.'
  : error instanceof Error ? error.message : 'Internal server error';
```

### Logging

All errors are logged with full details for debugging:

```typescript
logger.error('Operation failed', {
  error: error.message,
  stack: error.stack,
  userId,
  projectId,
});
```

But only generic messages are returned to clients in production.

## Updated API Routes

The following routes have been updated with consistent error handling:

1. `POST /api/projects` - Create project
2. `GET /api/projects` - List projects
3. `GET /api/projects/[id]` - Get project details
4. `POST /api/projects/[id]/analyse` - Trigger analysis
5. `PATCH /api/findings/[id]` - Update finding
6. `POST /api/findings/[id]/fix` - Trigger fix

## Testing

All error scenarios should be tested:

1. Invalid input (400)
2. Missing authentication (401)
3. Insufficient permissions (403)
4. Resource not found (404)
5. Rate limit exceeded (429)
6. Database connection failure (500)
7. External API failures (GitHub, Gemini, E2B)

## Future Improvements

1. Implement retry logic for transient database errors
2. Add circuit breaker pattern for external API calls
3. Implement request timeout handling
4. Add more specific error codes for different failure scenarios
5. Implement user-friendly error messages in the UI
