import { getServiceSupabase } from './supabase';
import { generateEmbedding } from './embeddings';

interface ContextResult {
  memories: string;
  documents: string;
}

/**
 * Gathers relevant context from memories and documents for a given query.
 */
export async function assembleContext(query: string): Promise<ContextResult> {
  try {
    const embedding = await generateEmbedding(query);
    const embeddingStr = `[${embedding.join(',')}]`;
    const supabase = getServiceSupabase();

    // 1. Fetch Memories
    const { data: memories, error: memError } = await supabase.rpc('match_memorias', {
      query_embedding: embeddingStr,
      match_threshold: 0.7,
      match_count: 5
    });

    // 2. Fetch Documents
    const { data: documents, error: docError } = await supabase.rpc('match_documentos', {
      query_embedding: embeddingStr,
      match_threshold: 0.7,
      match_count: 5
    });

    if (memError) console.error('Error matching memories:', memError);
    if (docError) console.error('Error matching documents:', docError);

    const memoriesText = memories
      ? memories.map((m: any) => `- ${m.mem_conteudo}`).join('\n')
      : '';

    const documentsText = documents
      ? documents.map((d: any) => `Documento [${d.doc_nome}]: ${d.dch_texto}`).join('\n---\n')
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
