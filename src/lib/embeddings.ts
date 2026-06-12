import { openRouter } from './openrouter';
import { embed, embedMany } from 'ai';

// Using a cheap, fast, and high-quality embedding model supported via OpenRouter or direct OpenAI 
// OpenRouter supports text-embedding models like openai/text-embedding-3-small
// If text-embedding-3-small is selected, the vector size must be 1536 (matching the DB schema).
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';

/**
 * Generates an embedding vector for a single string.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { embedding } = await embed({
      model: openRouter.embedding(EMBEDDING_MODEL),
      value: text,
    });
    return embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw error;
  }
}

/**
 * Generates embeddings for an array of strings.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const { embeddings } = await embedMany({
      model: openRouter.embedding(EMBEDDING_MODEL),
      values: texts,
    });
    return embeddings;
  } catch (error) {
    console.error('Failed to generate embeddings:', error);
    throw error;
  }
}
