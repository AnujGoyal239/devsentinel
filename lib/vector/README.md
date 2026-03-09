# Vector Search Module

This module provides semantic code search functionality using Jina Embeddings and Qdrant vector database.

## Architecture

```
Source Files → Jina Embeddings API → 768-dim vectors → Qdrant Cloud
                                                            ↓
                                                    Semantic Search
                                                            ↓
                                                    Related Files
```

## Components

### `jina.ts` - Jina Embeddings API Client

Generates vector embeddings for text using Jina AI's API.

- **Model**: `jina-embeddings-v2-base-en`
- **Dimensions**: 768
- **Free Tier**: 1M tokens/month

**Functions**:
- `generateEmbedding(text: string)` - Generate embedding for single text
- `generateEmbeddingsBatch(texts: string[])` - Generate embeddings for multiple texts (batches of 10)

### `qdrant.ts` - Qdrant Vector Database Client

Stores and queries code embeddings.

- **Collection per project**: `project_{project_id}`
- **Distance metric**: Cosine similarity
- **Free Tier**: 1GB storage

**Functions**:
- `createCollection(projectId: string)` - Create collection for project
- `deleteCollection(projectId: string)` - Delete collection when project is deleted
- `storeEmbeddings(projectId: string, files: FileEmbedding[])` - Store file embeddings
- `searchSimilarFiles(projectId: string, query: string, topK: number)` - Search for similar files

## API Endpoints

### `POST /api/projects/[id]/embeddings`

Generate embeddings for all project files.

**Process**:
1. Fetch file tree from GitHub
2. Filter out binary files and files >100KB
3. Fetch file contents in batches of 10
4. Generate embeddings using Jina API
5. Store in Qdrant collection

**Response**:
```json
{
  "success": true,
  "files_processed": 150
}
```

### `GET /api/projects/[id]/embeddings?query=...&topK=5`

Search for similar files using semantic search.

**Query Parameters**:
- `query` (required) - Text to search for
- `topK` (optional) - Number of results (default: 5)
- `excludePath` (optional) - File path to exclude from results

**Response**:
```json
[
  {
    "file_path": "src/auth/login.ts",
    "content": "...",
    "score": 0.92
  }
]
```

**Caching**: Results cached in Redis for 5 minutes

### `DELETE /api/projects/[id]/embeddings`

Clean up collection when project is deleted.

## Usage in Analysis Pipeline

During **Pass 2 (Bug Detection)**, for each file being analyzed:

1. Generate embedding for current file content
2. Query Qdrant for top-5 most similar files
3. Include similar files as "related files" context in Gemini prompt
4. This enables cross-file bug detection (broken imports, API mismatches, etc.)

**Example**:
```typescript
import { searchSimilarFiles } from '@/lib/vector';

// During Pass 2 analysis
const relatedFiles = await searchSimilarFiles(
  projectId,
  currentFileContent,
  5,
  currentFilePath // exclude current file
);

// Include in Gemini prompt
const prompt = `
CURRENT FILE: ${currentFilePath}
${currentFileContent}

RELATED FILES:
${relatedFiles.map(f => `${f.file_path}:\n${f.content}`).join('\n\n')}

Analyze for bugs...
`;
```

## File Filtering

Files are filtered before embedding generation:

**Excluded**:
- Binary files (images, fonts, archives)
- Large files (>100KB)
- Generated files (node_modules, dist, build)
- Lock files (package-lock.json, yarn.lock)
- Minified files (*.min.js, *.min.css)

**Included**:
- Source code files (.ts, .js, .py, .go, etc.)
- Configuration files
- Documentation files

## Error Handling

- **Jina API errors**: Throws error with status code and message
- **Qdrant errors**: Logs error and continues (graceful degradation)
- **GitHub API errors**: Retries with exponential backoff (up to 3 attempts)
- **Collection not found**: Creates collection automatically

## Environment Variables

Required in `.env`:

```bash
JINA_API_KEY=your_jina_api_key
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key
```

## Performance

- **Embedding generation**: ~100ms per file (batched)
- **Vector search**: ~50ms per query
- **Storage**: ~3KB per file embedding
- **Batch size**: 10 files per batch (rate limit protection)

## Free Tier Limits

- **Jina**: 1M tokens/month (~5,000 files of 200 tokens each)
- **Qdrant**: 1GB storage (~300,000 embeddings)

For a typical 500-file repository:
- Embeddings: ~100K tokens (well within free tier)
- Storage: ~1.5MB (well within free tier)
