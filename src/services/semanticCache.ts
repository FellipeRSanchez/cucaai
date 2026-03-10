import { getServiceSupabase } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/embeddings';

interface CacheMatch {
  id: string;
  pergunta: string;
  resposta: string;
  similaridade: number;
}

/**
 * Check the semantic cache for a highly similar previous question.
 * Uses the default threshold of 0.92 as defined in the project scope.
 */
export async function checkSemanticCache(
  query: string,
  threshold: number = 0.92
): Promise<CacheMatch | null> {
  try {
    // 1. Generate embedding for the incoming user question
    const queryEmbedding = await generateEmbedding(query);

    // 2. Query the Supabase RPC function for cosine similarity
    const supabase = getServiceSupabase();
    
    // We format the array of numbers to the string format expected by pgvector: '[0.1, 0.2, ...]'
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const { data, error } = await supabase.rpc('match_cache_semantico', {
      query_embedding: embeddingStr,
      match_threshold: threshold,
      match_count: 1
    });

    if (error) {
      console.error('Supabase Semantic Cache Error:', error);
      return null;
    }

    if (data && data.length > 0) {
      return data[0] as CacheMatch;
    }

    return null;
  } catch (err) {
    console.error('Error checking semantic cache:', err);
    return null;
  }
}

/**
 * Save a new question and its AI response to the semantic cache.
 */
export async function saveToSemanticCache(
  query: string,
  response: string,
  modelUsed: string
): Promise<void> {
  try {
    const supabase = getServiceSupabase();
    const queryEmbedding = await generateEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const { error } = await supabase.schema('cuca').from('cache_semantico').insert({
      cac_pergunta: query,
      cac_embedding: embeddingStr,
      cac_resposta: response,
      cac_modelo: modelUsed
    });

    if (error) {
      console.error('Failed to save to semantic cache:', error);
    }
  } catch (err) {
    console.error('Error saving to semantic cache:', err);
  }
}
