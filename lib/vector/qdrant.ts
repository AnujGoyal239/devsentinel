/**
 * Qdrant Vector Database Client
 * 
 * Stores and queries code embeddings for semantic cross-file search.
 * Collection per project: project_{project_id}
 * Vector dimensions: 768 (Jina embeddings)
 * Distance metric: Cosine similarity
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '@/lib/config/env';
import { generateEmbedding, generateEmbeddingsBatch } from './jina';

const VECTOR_SIZE = 768;
const DISTANCE_METRIC = 'Cosine';

let qdrantClient: QdrantClient | null = null;

/**
 * Get or create Qdrant client singleton
 */
export function getQdrantClient(): QdrantClient {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY,
    });
  }
  return qdrantClient;
}

/**
 * Export qdrantClient for direct access (lazy initialization)
 */
export { qdrantClient };

/**
 * Get collection name for a project
 */
export function getCollectionName(projectId: string): string {
  return projectId;
}

/**
 * Create a collection for a project
 */
export async function createCollection(projectId: string): Promise<void> {
  const client = getQdrantClient();
  const collectionName = getCollectionName(projectId);

  try {
    // Check if collection already exists
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);

    if (exists) {
      console.log(`Collection ${collectionName} already exists`);
      return;
    }

    // Create new collection
    await client.createCollection(collectionName, {
      vectors: {
        size: VECTOR_SIZE,
        distance: DISTANCE_METRIC,
      },
    });

    console.log(`Created collection ${collectionName}`);
  } catch (error) {
    throw new Error(`Failed to create collection: ${error}`);
  }
}

/**
 * Delete a collection for a project
 */
export async function deleteCollection(projectId: string): Promise<void> {
  const client = getQdrantClient();
  const collectionName = getCollectionName(projectId);

  try {
    await client.deleteCollection(collectionName);
    console.log(`Deleted collection ${collectionName}`);
  } catch (error) {
    // Ignore error if collection doesn't exist
    console.log(`Collection ${collectionName} not found or already deleted`);
  }
}

export interface FileEmbedding {
  id: string;
  file_path: string;
  content: string;
  sha: string;
}

/**
 * Store embeddings for files in Qdrant
 * Processes files in batches to avoid rate limits
 */
export async function storeEmbeddings(
  projectId: string,
  files: FileEmbedding[]
): Promise<void> {
  const client = getQdrantClient();
  const collectionName = getCollectionName(projectId);

  // Ensure collection exists
  await createCollection(projectId);

  // Generate embeddings in batches
  const contents = files.map(f => f.content);
  const embeddings = await generateEmbeddingsBatch(contents);

  // Prepare points for Qdrant
  const points = files.map((file, index) => ({
    id: file.id,
    vector: embeddings[index],
    payload: {
      file_path: file.file_path,
      content: file.content,
      sha: file.sha,
    },
  }));

  // Upload to Qdrant
  await client.upsert(collectionName, {
    wait: true,
    points,
  });

  console.log(`Stored ${files.length} embeddings in collection ${collectionName}`);
}

export interface SearchResult {
  file_path: string;
  content: string;
  score: number;
}

/**
 * Search for similar files using semantic search
 * Returns top-k most similar files based on cosine similarity
 */
export async function searchSimilarFiles(
  projectId: string,
  queryText: string,
  topK: number = 5,
  excludePath?: string
): Promise<SearchResult[]> {
  const client = getQdrantClient();
  const collectionName = getCollectionName(projectId);

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(queryText);

  // Build filter to exclude current file if specified
  const filter = excludePath
    ? {
        must_not: [
          {
            key: 'file_path',
            match: { value: excludePath },
          },
        ],
      }
    : undefined;

  // Search in Qdrant
  const searchResults = await client.search(collectionName, {
    vector: queryEmbedding,
    limit: topK,
    filter,
    with_payload: true,
  });

  // Map results to SearchResult format
  return searchResults.map(result => ({
    file_path: result.payload?.file_path as string,
    content: result.payload?.content as string,
    score: result.score,
  }));
}
