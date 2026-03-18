import { getServiceSupabase } from './supabase';
import { generateEmbedding } from './embeddings';

interface ContextResult {
  memories: string;
  documents: string;
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
export async function assembleContext(query: string, userId?: string): Promise<ContextResult> {
  try {
    const supabase = getServiceSupabase();
    const terms = extractSearchTerms(query).map(sanitizeLikeTerm).filter(Boolean);

    if (!userId) {
      return {
        memories: 'Sem usuário autenticado para recuperar memórias.',
        documents: 'Sem usuário autenticado para recuperar documentos.'
      };
    }

    // 1. Fetch Memories (Keyword for now, vector would be better too)
    let memories: any[] = [];
    // ... (Keep existing memory logic for now to stay focused on documents)

    // 2. Fetch Relevant Document Chunks (Vector Search - The "Real" RAG)
    let semanticDocs: any[] = [];
    try {
      const queryEmbedding = await generateEmbedding(query);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      const { data: matchedChunks, error: chunkError } = await supabase.rpc('match_document_chunks', {
        query_embedding: embeddingStr,
        match_threshold: 0.35, // Low threshold to allow some variety
        match_count: 8,       // More chunks for better context
        p_usuario_id: userId
      });

      if (chunkError) {
        console.error('[RAG] Vector search error (RPC):', chunkError);
      } else if (matchedChunks && matchedChunks.length > 0) {
        console.log(`[RAG] Semantic match found ${matchedChunks.length} chunks`);
        semanticDocs = matchedChunks;
      } else {
        console.log('[RAG] No semantic chunks found for query. Try checking your embedding threshold or if embeddings are generated correctly.');
      }
    } catch (err) {
      console.error('[RAG] Unexpected error in vector search:', err);
    }

    // 3. Fallback to Documents metadata/keyword if no chunks found or to complement
    let keywordDocs: any[] = [];
    if (terms.length > 0) {
      const orFilterDocs = terms
        .slice(0, 3)
        .map((t) => `doc_conteudo.ilike.%${t}%`)
        .join(',');

      const { data: matchedDocs } = await supabase
        .schema('cuca')
        .from('documentos')
        .select('doc_nome, doc_conteudo, doc_criado_em')
        .eq('doc_usuario_id', userId)
        .or(orFilterDocs)
        .order('doc_criado_em', { ascending: false })
        .limit(3);
      
      keywordDocs = matchedDocs ?? [];
    }

    // 4. Combine results
    const combinedDocs = new Map();
    
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

    const memoriesText = memories
      ? memories.map((m: any) => `- ${m.mem_conteudo}`).join('\n')
      : '';

    return {
      memories: memoriesText || 'Nenhuma memória relevante encontrada.',
      documents: documentsText || 'Nenhum documento relevante encontrado.'
    };
  } catch (error) {
    console.error('Error assembling context:', error);
    return {
      memories: 'Erro ao recuperar memórias.',
      documents: 'Erro ao recuperar documentos.'
    };
  }
}
