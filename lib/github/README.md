# GitHub Integration Layer

This module provides GitHub REST API integration for the DevSentinel platform.

## Features

- **File Tree Fetching**: Retrieve complete repository file structure
- **File Content Fetching**: Get individual file contents with base64 decoding
- **Tech Stack Detection**: Auto-detect technology stack from dependency files
- **Exponential Backoff**: Automatic retry logic for rate limit errors
- **Redis Caching**: 5-minute TTL cache for GitHub API responses

## Modules

### `client.ts`

Core GitHub API client using Octokit.

**Functions:**
- `fetchRepoTree(owner, repo, branch, token)` - Fetch complete file tree
- `fetchFileContent(owner, repo, path, token)` - Fetch individual file content
- `getRateLimit(token)` - Get current rate limit status

**Features:**
- Exponential backoff retry (max 3 attempts)
- Redis caching (5 minutes TTL)
- Filters out directories, returns only files

### `tech-stack.ts`

Auto-detects technology stack from repository files.

**Supported Stacks:**
- Node.js/JavaScript/TypeScript (package.json)
- Python (requirements.txt, pyproject.toml)
- Go (go.mod)
- Ruby (Gemfile)
- Rust (Cargo.toml)
- Java Maven (pom.xml)
- Java/Kotlin Gradle (build.gradle, build.gradle.kts)

**Function:**
- `detectTechStack(owner, repo, files, token)` - Returns TechStack object or null

## API Endpoints

### GET `/api/projects/:id/files`

Fetch repository file tree and detect tech stack.

**Response:**
```json
{
  "files": [
    {
      "path": "src/index.ts",
      "type": "blob",
      "sha": "abc123",
      "size": 1024
    }
  ],
  "total": 150,
  "tech_stack": {
    "framework": "Next.js",
    "language": "TypeScript",
    "dependencies": ["next", "react", "typescript"]
  }
}
```

### GET `/api/projects/:id/files/:path`

Fetch individual file content.

**Response:**
```json
{
  "path": "src/index.ts",
  "content": "console.log('Hello World');",
  "project_id": "uuid",
  "repo_owner": "owner",
  "repo_name": "repo"
}
```

## Error Handling

The client handles the following GitHub API errors:

- **401 Unauthorized**: Token expired or invalid
- **403 Forbidden**: Missing OAuth scope or rate limit exceeded
- **404 Not Found**: Repository or file not found
- **429 Too Many Requests**: Rate limit exceeded (triggers retry)

## Caching Strategy

All GitHub API responses are cached in Redis with a 5-minute TTL to reduce API calls and improve performance:

- File tree: `github:tree:{owner}:{repo}:{branch}`
- File content: `github:file:{owner}:{repo}:{path}`

Cache is automatically invalidated after 5 minutes or when a new analysis run is triggered.

## Rate Limits

GitHub API rate limits:
- **Authenticated**: 5,000 requests/hour per user
- **Unauthenticated**: 60 requests/hour

The client automatically retries with exponential backoff when rate limits are hit.

## Testing

Run tests with:
```bash
npm test -- lib/github/__tests__/client.test.ts --run
npm test -- lib/github/__tests__/tech-stack.test.ts --run
```

## Usage Example

```typescript
import { fetchRepoTree, fetchFileContent } from '@/lib/github/client';
import { detectTechStack } from '@/lib/github/tech-stack';

// Fetch file tree
const tree = await fetchRepoTree('owner', 'repo', 'main', token);
console.log(`Found ${tree.total} files`);

// Detect tech stack
const filePaths = tree.files.map(f => f.path);
const techStack = await detectTechStack('owner', 'repo', filePaths, token);
console.log(`Framework: ${techStack?.framework}`);

// Fetch file content
const content = await fetchFileContent('owner', 'repo', 'package.json', token);
console.log(content);
```
