/**
 * Vector Search Integration
 * 
 * Main entry point for vector search functionality.
 * Exports all vector search functions for use in the analysis pipeline.
 */

export {
  generateEmbedding,
  generateEmbeddingsBatch,
} from './jina';

export {
  getQdrantClient,
  getCollectionName,
  createCollection,
  deleteCollection,
  storeEmbeddings,
  searchSimilarFiles,
  type FileEmbedding,
  type SearchResult,
} from './qdrant';

/**
 * Process repository files for embedding generation
 * Filters out binary files and files larger than 100KB
 */
export function filterFilesForEmbedding(files: Array<{ path: string; size?: number }>): Array<{ path: string; size?: number }> {
  const skipPatterns = [
    /node_modules/,
    /\.git\//,
    /dist\//,
    /build\//,
    /lock/,  // Matches lock files (package-lock.json, yarn.lock, etc.)
    /\.min\./,
    /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf|zip|tar|gz)$/i,
  ];

  return files.filter(file => {
    // Skip large files (>100KB)
    if (file.size && file.size > 100000) return false;

    // Skip binary/generated files
    return !skipPatterns.some(pattern => pattern.test(file.path));
  });
}
