import { getServiceSupabase } from './supabase';
import { generateEmbedding } from './embeddings';

interface ContextResult {
  memories: string;
  documents: string;
}

interface MemoryRow {
  mem_conteudo: string;
  mem_criado_em?: string;
}

interface MatchedChunk {
  doc_nome: string;
  dch_texto: string;
}

interface KeywordDoc {
  doc_nome: string;
  doc_conteudo: string | null;
  doc_criado_em?: string;
}

function extractSearchTerms(query: string): string[] {
  const stopwords = new Set([
    'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'é', 'em', 'no', 'na', 'nos', 'nas',
    'para', 'por', 'com', 'sem', 'um', 'uma', 'uns', 'umas', 'que', 'qual', 'quais', 'como', 'meu',
    'minha', 'meus', 'minhas', 'sobre', 'tem', 'tenho', 'você', 'vc'
  ]);

  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !stopwords.has(t))
    .slice(0, 5);
}

function sanitizeLikeTerm(term: string): string {
  return term.replace(/[%_,]/g, '').trim();
}

/**
 * Gathers relevant context from memories and documents for a given query.
 */
export async function assembleContext(query: string, userId?: string, projectId?: string): Promise<ContextResult> {
  try {
    const supabase = getServiceSupabase();
    const terms = extractSearchTerms(query).map(sanitizeLikeTerm).filter(Boolean);

    if (!userId) {
      return {
        memories: 'Sem usuário autenticado para recuperar memórias.',
        documents: 'Sem usuário autenticado para recuperar documentos.'
      };
    }

    // 1. Fetch Memories (vector search first, then keyword fallback)
    let memories: MemoryRow[] = [];
    try {
      // Primary: vector similarity search via RPC
      try {
        const queryEmbedding = await generateEmbedding(query);
        const embeddingStr = `[${queryEmbedding.join(',')}]`;
        console.log(`[RAG] Embedding generated: dim=${queryEmbedding.length}, first5=[${queryEmbedding.slice(0, 5).map(v => v.toFixed(6)).join(',')}], last3=[${queryEmbedding.slice(-3).map(v => v.toFixed(6)).join(',')}]`);

        const { data: vectorMemories, error: vectorError } = await supabase.rpc('match_memorias', {
          query_embedding: embeddingStr,
          match_threshold: 0.3,
          match_count: 10,
          p_user_id: userId
        });

        console.log(`[RAG] match_memorias RPC: error=${vectorError?.message ?? 'none'}, data=${vectorMemories ? `array[${vectorMemories.length}]` : 'null'}${vectorMemories && vectorMemories.length > 0 ? ` (best=${vectorMemories[0]?.similarity?.toFixed(4) ?? '?'})` : ''}`);

        if (vectorError) {
          console.error('[RAG] Vector memory RPC error:', vectorError);
        } else if (vectorMemories && vectorMemories.length > 0) {
          memories = vectorMemories.map((m: { mem_conteudo: string; mem_criado_em?: string; similarity?: number }) => ({
            mem_conteudo: m.mem_conteudo,
            mem_criado_em: m.mem_criado_em
          })) as MemoryRow[];
          console.log(`[RAG] Vector search found ${memories.length} memories (best similarity: ${vectorMemories[0]?.similarity?.toFixed(4) ?? '?'})`);
        } else {
          console.log('[RAG] Vector search returned 0 results, trying keyword fallback');
        }
      } catch (vectorErr) {
        console.error('[RAG] Vector memory search failed, falling back to keywords:', vectorErr);
      }

      // Fallback: keyword-based search if vector search returned nothing
      if (memories.length === 0 && terms.length > 0) {
        const orFilterMemories = terms
          .slice(0, 3)
          .map((t) => `mem_conteudo.ilike.%${t}%`)
          .join(',');

        let memQuery = supabase
          .schema('cuca')
          .from('memorias')
          .select('mem_conteudo, mem_criado_em')
          .eq('mem_usuario_id', userId);

        if (projectId) {
          memQuery = memQuery.eq('mem_projeto_id', projectId);
        } else {
          memQuery = memQuery.is('mem_projeto_id', null);
        }

        const { data: matchedMemories, error: memoryError } = await memQuery
          .or(orFilterMemories)
          .order('mem_criado_em', { ascending: false })
          .limit(5);

        if (memoryError) {
          console.error('[RAG] Keyword memory search failed, trying without project filter:', memoryError);
          // Retry without project filter (mem_projeto_id column might not exist)
          try {
            const { data: retryMemories, error: retryError } = await supabase
              .schema('cuca')
              .from('memorias')
              .select('mem_conteudo, mem_criado_em')
              .eq('mem_usuario_id', userId)
              .or(orFilterMemories)
              .order('mem_criado_em', { ascending: false })
              .limit(5);

            if (!retryError && retryMemories) {
              memories = retryMemories as MemoryRow[];
            }
          } catch {
            // ignore
          }
        } else {
          memories = (matchedMemories ?? []) as MemoryRow[];
        }
      }

      // Last fallback: most recent memories
      if (memories.length === 0) {
        let latestMemQuery = supabase
          .schema('cuca')
          .from('memorias')
          .select('mem_conteudo, mem_criado_em')
          .eq('mem_usuario_id', userId);

        if (projectId) {
          latestMemQuery = latestMemQuery.eq('mem_projeto_id', projectId);
        } else {
          latestMemQuery = latestMemQuery.is('mem_projeto_id', null);
        }

        const { data: latestMemories, error: latestMemoryError } = await latestMemQuery
          .order('mem_criado_em', { ascending: false })
          .limit(3);

        if (latestMemoryError) {
          console.error('[RAG] Latest memories query failed, trying without project filter:', latestMemoryError);
          // Retry without project filter
          try {
            const { data: retryLatest, error: retryErr } = await supabase
              .schema('cuca')
              .from('memorias')
              .select('mem_conteudo, mem_criado_em')
              .eq('mem_usuario_id', userId)
              .order('mem_criado_em', { ascending: false })
              .limit(3);

            if (!retryErr && retryLatest) {
              memories = retryLatest as MemoryRow[];
            }
          } catch {
            // ignore
          }
        } else {
          memories = (latestMemories ?? []) as MemoryRow[];
        }
      }
    } catch (memoryErr) {
      console.error('[RAG] Erro inesperado ao montar contexto de memórias:', memoryErr);
    }

    // 2. Fetch Relevant Document Chunks (Vector Search - The "Real" RAG)
    let semanticDocs: MatchedChunk[] = [];
    try {
      const queryEmbedding = await generateEmbedding(query);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      const { data: matchedChunks, error: chunkError } = await supabase.rpc('match_document_chunks', {
        query_embedding: embeddingStr,
        match_threshold: 0.25,
        match_count: 8,
        p_usuario_id: userId
      });

      console.log(`[RAG] match_document_chunks RPC: error=${chunkError?.message ?? 'none'}, data=${matchedChunks ? `array[${matchedChunks.length}]` : 'null'}`);

      if (chunkError) {
        console.error('[RAG] Vector search error (RPC):', chunkError);
      } else if (matchedChunks && matchedChunks.length > 0) {
        console.log(`[RAG] Semantic match found ${matchedChunks.length} chunks`);
        semanticDocs = matchedChunks as MatchedChunk[];
      } else {
        console.log('[RAG] No semantic chunks found for query. Try checking your embedding threshold or if embeddings are generated correctly.');
      }
    } catch (err) {
      console.error('[RAG] Unexpected error in vector search:', err);
    }

    // 3. Fallback to Documents metadata/keyword if no chunks found or to complement
    let keywordDocs: KeywordDoc[] = [];
    if (terms.length > 0) {
      const orFilterDocs = terms
        .slice(0, 3)
        .map((t) => `doc_conteudo.ilike.%${t}%`)
        .join(',');

      let docQuery = supabase
        .schema('cuca')
        .from('documentos')
        .select('doc_nome, doc_conteudo, doc_criado_em')
        .eq('doc_usuario_id', userId);

      if (projectId) {
        docQuery = docQuery.eq('doc_projeto_id', projectId);
      } else {
        docQuery = docQuery.is('doc_projeto_id', null);
      }

      const { data: matchedDocs } = await docQuery
        .or(orFilterDocs)
        .order('doc_criado_em', { ascending: false })
        .limit(3);
      
      keywordDocs = (matchedDocs ?? []) as KeywordDoc[];
    }

    // 4. Combine results
    const combinedDocs = new Map<string, string[]>();
    
    // Add semantic chunks first
    semanticDocs.forEach(chunk => {
      const existing = combinedDocs.get(chunk.doc_nome) || [];
      existing.push(chunk.dch_texto);
      combinedDocs.set(chunk.doc_nome, existing);
    });

    // Add keyword snippets if document not already fully covered
    keywordDocs.forEach(doc => {
      if (!combinedDocs.has(doc.doc_nome)) {
        const content = (doc.doc_conteudo ?? '').toString();
        const snippet = content.length > 1500 ? `${content.slice(0, 1500)}...` : content;
        combinedDocs.set(doc.doc_nome, [snippet]);
      }
    });

    const documentsText = Array.from(combinedDocs.entries())
      .map(([name, contents]) => {
        return `Documento [${name}]:\n${contents.join('\n[...]\n')}`;
      })
      .join('\n---\n');

    const memoriesText = memories.length > 0
      ? memories
          .map((m) => m.mem_conteudo?.trim())
          .filter((content): content is string => Boolean(content))
          .map((content) => `- ${content}`)
          .join('\n')
      : '';

    return {
      memories: memoriesText,
      documents: documentsText
    };
  } catch (error) {
    console.error('Error assembling context:', error);
    return {
      memories: 'Erro ao recuperar memórias.',
      documents: 'Erro ao recuperar documentos.'
    };
  }
}
