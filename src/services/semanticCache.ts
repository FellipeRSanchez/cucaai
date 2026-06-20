import { getServiceSupabase } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/embeddings';

interface CacheMatch {
  id: string;
  pergunta: string;
  resposta: string;
  similaridade: number;
}

// Profile-related queries should never be cached because the answer depends
// on dynamic user data that changes as memories are created/updated.
const PROFILE_PATTERNS = [
  /\bmeu\s+nome\b/i,
  /\bminha\s+nome\b/i,
  /\bseu\s+nome\b/i,
  /\bcomo\s+(me\s+)?chamo/i,
  /\bqual\s+(o\s+)?nome/i,
  /\bquem\s+(eu\s+)?sou\b/i,
  /\banivers[aá]rio\b/i,
  /\bdata\s+de\s+nascimento\b/i,
  /\bidade\b/i,
  /\bendere[çc]o\b/i,
  /\btelefone\b/i,
  /\bcpf\b/i,
  /\bcnpj\b/i,
  /\bprofiss[aã]o\b/i,
  /\btrabalho\s+com\b/i,
  /\bmoro\s+em\b/i,
  /\bcidade\b/i,
  /\bestado\b/i,
];

/**
 * Check if a query is about user profile information.
 * Profile queries should NOT be cached because the answer depends
 * on dynamic memories that change over time.
 */
export function isProfileQuery(query: string): boolean {
  return PROFILE_PATTERNS.some((pattern) => pattern.test(query));
}

// Cache TTL: entries older than this are ignored (7 days)
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check the semantic cache for a highly similar previous question.
 * Uses the default threshold of 0.92 as defined in the project scope.
 * Skips cache for profile-related queries and entries older than TTL.
 */
export async function checkSemanticCache(
  query: string,
  threshold: number = 0.92
): Promise<CacheMatch | null> {
  // Never serve cached responses for profile queries
  if (isProfileQuery(query)) {
    return null;
  }

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
      const match = data[0] as CacheMatch;

      // TTL check: verify the cached entry is not too old
      // The RPC doesn't return timestamps, so we do a secondary lookup
      try {
        const { data: row } = await supabase
          .schema('cuca')
          .from('cache_semantico')
          .select('cac_criado_em')
          .eq('cac_id', match.id)
          .single();

        if (row?.cac_criado_em) {
          const createdAt = new Date(row.cac_criado_em).getTime();
          if (Date.now() - createdAt > CACHE_TTL_MS) {
            console.log(`[Cache] Entry ${match.id} expired (TTL), skipping`);
            return null;
          }
        }
      } catch {
        // If TTL check fails, serve the cached entry anyway
      }

      return match;
    }

    return null;
  } catch (err) {
    console.error('Error checking semantic cache:', err);
    return null;
  }
}

/**
 * Save a new question and its AI response to the semantic cache.
 * Skips profile queries since their answers depend on dynamic data.
 */
export async function saveToSemanticCache(
  query: string,
  response: string,
  modelUsed: string
): Promise<void> {
  // Never cache profile-related queries
  if (isProfileQuery(query)) {
    return;
  }

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
