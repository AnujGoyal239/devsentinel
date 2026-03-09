/**
 * Jina Embeddings API Client
 * 
 * Generates vector embeddings for source file contents using Jina AI's API.
 * Model: jina-embeddings-v2-base-en (768 dimensions)
 * Free tier: 1M tokens/month
 */

import { env } from '@/lib/config/env';

const JINA_API_URL = 'https://api.jina.ai/v1/embeddings';
const JINA_MODEL = 'jina-embeddings-v2-base-en';

export interface JinaEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
    prompt_tokens: number;
  };
}

/**
 * Generate embeddings for a single text input
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(JINA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.JINA_API_KEY}`,
    },
    body: JSON.stringify({
      model: JINA_MODEL,
      input: [text],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jina API error: ${response.status} - ${error}`);
  }

  const data: JinaEmbeddingResponse = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple text inputs in batch
 * Processes up to 10 texts at a time to avoid rate limits
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 10;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    
    const response = await fetch(JINA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.JINA_API_KEY}`,
      },
      body: JSON.stringify({
        model: JINA_MODEL,
        input: batch,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jina API error: ${response.status} - ${error}`);
    }

    const data: JinaEmbeddingResponse = await response.json();
    results.push(...data.data.map(d => d.embedding));
  }

  return results;
}
