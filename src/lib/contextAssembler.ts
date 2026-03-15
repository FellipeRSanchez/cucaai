import { getServiceSupabase } from './supabase';

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

    // 1. Fetch Memories (keyword match first, fallback to latest)
    let memories: any[] = [];

    if (terms.length > 0) {
      const orFilter = terms
        .slice(0, 3)
        .map((t) => `mem_conteudo.ilike.%${t}%`)
        .join(',');

      const { data: matchedMemories, error: memMatchError } = await supabase
        .schema('cuca')
        .from('memorias')
        .select('mem_conteudo, mem_relevancia, mem_criado_em')
        .eq('mem_usuario_id', userId)
        .or(orFilter)
        .order('mem_relevancia', { ascending: false })
        .order('mem_criado_em', { ascending: false })
        .limit(8);

      if (memMatchError) {
        console.error('Error matching memories by keyword:', memMatchError);
      } else if (matchedMemories && matchedMemories.length > 0) {
        memories = matchedMemories;
      }
    }

    if (memories.length === 0) {
      const { data: latestMemories, error: memLatestError } = await supabase
        .schema('cuca')
        .from('memorias')
        .select('mem_conteudo, mem_relevancia, mem_criado_em')
        .eq('mem_usuario_id', userId)
        .order('mem_criado_em', { ascending: false })
        .limit(8);

      if (memLatestError) {
        console.error('Error loading latest memories:', memLatestError);
      } else {
        memories = latestMemories ?? [];
      }
    }

    // 2. Fetch Documents (keyword match first, fallback to latest)
    let documents: any[] = [];

    if (terms.length > 0) {
      const orFilterDocs = terms
        .slice(0, 3)
        .map((t) => `doc_conteudo.ilike.%${t}%`)
        .join(',');

      const { data: matchedDocs, error: docMatchError } = await supabase
        .schema('cuca')
        .from('documentos')
        .select('doc_nome, doc_conteudo, doc_criado_em')
        .eq('doc_usuario_id', userId)
        .or(orFilterDocs)
        .order('doc_criado_em', { ascending: false })
        .limit(5);

      if (docMatchError) {
        console.error('Error matching documents by keyword:', docMatchError);
      } else if (matchedDocs && matchedDocs.length > 0) {
        documents = matchedDocs;
      }
    }

    if (documents.length === 0) {
      const { data: latestDocs, error: docLatestError } = await supabase
        .schema('cuca')
        .from('documentos')
        .select('doc_nome, doc_conteudo, doc_criado_em')
        .eq('doc_usuario_id', userId)
        .order('doc_criado_em', { ascending: false })
        .limit(3);

      if (docLatestError) {
        console.error('Error loading latest documents:', docLatestError);
      } else {
        documents = latestDocs ?? [];
      }
    }

    const memoriesText = memories
      ? memories.map((m: any) => `- ${m.mem_conteudo}`).join('\n')
      : '';

    const documentsText = documents
      ? documents
        .map((d: any) => {
          const content = (d.doc_conteudo ?? '').toString().replace(/\s+/g, ' ').trim();
          const snippet = content.length > 800 ? `${content.slice(0, 800)}...` : content;
          return `Documento [${d.doc_nome}]: ${snippet}`;
        })
        .join('\n---\n')
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
