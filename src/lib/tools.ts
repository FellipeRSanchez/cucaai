import { tool, generateText } from 'ai';
import { z } from 'zod';
import { getServiceSupabase } from './supabase';
import { generateEmbedding } from './embeddings';
import { openRouter } from './openrouter';

/**
 * Common tools that the Agents can use.
 */

// Helper to parse DMS coordinates (e.g., 21°17'43.26"S) into decimal
function parseDMS(dmsStr: string): number | null {
  const match = dmsStr.match(/(\d+)[°\s]+(\d+)['\s]+([\d.]+)[″"\s]*([NSWE])/i);
  if (!match) return null;
  const degrees = parseFloat(match[1]);
  const minutes = parseFloat(match[2]);
  const seconds = parseFloat(match[3]);
  const direction = match[4].toUpperCase();
  
  let dd = degrees + minutes/60 + seconds/3600;
  if (direction === 'S' || direction === 'W') {
    dd = dd * -1;
  }
  return dd;
}

// Extract coordinates from a string (Decimal or DMS)
function extractCoordinates(input: string) {
   // Check decimal like -21.29535, -50.38662
   const decimalMatch = input.match(/(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)/);
   if (decimalMatch) {
       return { lat: parseFloat(decimalMatch[1]), lon: parseFloat(decimalMatch[2]) };
   }
   
   // Check DMS like 21°17'43.26"S 50°23'11.83"W
   const dmsMatches = input.match(/(\d+[°\s]+\d+['\s]+[\d.]+[″"\s]*[NSWE])/ig);
   if (dmsMatches && dmsMatches.length >= 2) {
       const lat = parseDMS(dmsMatches[0]);
       const lon = parseDMS(dmsMatches[1]);
       if (lat !== null && lon !== null) return { lat, lon };
   }
   
   return null;
}


// 1. Memory Search
// This tool allows the agent to query the vector database for long-term or short-term memories.
export const searchMemory = tool({
  description: 'Search the user\'s personal permanent memory for context, preferences, or past events.',
  parameters: z.object({
    query: z.string().describe('The search query to look for in the user\'s memory.'),
  }),
  execute: async ({ query }) => {
    const supabase = getServiceSupabase();
    // In actual implementation, generate embedding and call supabase RPC for memory search
    const embedding = await generateEmbedding(query);
    const embeddingStr = `[${embedding.join(',')}]`;

    // Note: This requires an RPC function called 'match_memorias' to be added to Supabase
    // that compares `mem_embedding` with the query embedding.
    const { data, error } = await supabase.rpc('match_memorias', {
      query_embedding: embeddingStr,
      match_threshold: 0.75, // Lower threshold for broader context
      match_count: 5 // Get top 5 memories
    });

    if (error) {
       console.error("Error searching memory:", error);
       return { success: false, error: 'Failed to access memory.' };
    }

    if (!data || data.length === 0) {
      return { success: true, message: 'No relevant memories found for this query.' };
    }

    // Return the content of the matched memories
    const memoriesText = data.map((m: any) => m.mem_conteudo).join('\n---\n');
    return { success: true, results: memoriesText };
  },
});

// 2. Document Search (RAG)
export const searchDocuments = tool({
  description: 'Search through the user\'s uploaded documents and files for specific information.',
  parameters: z.object({
    query: z.string().describe('The search query or specific question to answer based on documents.'),
  }),
  execute: async ({ query }) => {
    const supabase = getServiceSupabase();
    const embedding = await generateEmbedding(query);
    const embeddingStr = `[${embedding.join(',')}]`;

    // Note: Requires RPC 'match_documentos' in Supabase
    const { data, error } = await supabase.rpc('match_documentos', {
      query_embedding: embeddingStr,
      match_threshold: 0.75,
      match_count: 5
    });

    if (error) {
       console.error("Error searching documents:", error);
       return { success: false, error: 'Failed to access documents.' };
    }

    if (!data || data.length === 0) {
      return { success: true, message: 'No relevant documents found.' };
    }

    const docsText = data.map((d: any) => `Document ID ${d.doc_id}:\n${d.dch_texto}`).join('\n---\n');
    return { success: true, results: docsText };
  },
});

import { searchWeb } from './webSearch';

// 3. Internet Search
export const internetSearch = tool({
  description: 'Search the internet for real-time information, news, or general knowledge not in local memory.',
  parameters: z.object({
    query: z.string().describe('The search query to look for online.'),
  }),
  execute: async ({ query }) => {
    const results = await searchWeb(query);
    if (!results || results.length === 0) {
      return { success: true, message: 'No results found on the internet.' };
    }
    const resultsText = results.map(r => `[${r.title}](${r.url})\n${r.snippet}`).join('\n---\n');
    return { success: true, results: resultsText };
  },
});

// 4. Weather Forecast
export const weatherForecast = tool({
  description: 'Consultar previsão do tempo (chuva, probabilidade, temperaturas) consolidada de múltiplas fontes. Entrada pode ser coordenadas geográficas ou nome de uma cidade.',
  parameters: z.object({
    location_input: z.string().describe('Coordenada em decimal, coordenada DMS ou nome da cidade.'),
    days: z.number().optional().describe('Filtro de dias para prever (opcional, padrão 7).'),
  }),
  execute: async ({ location_input, days }) => {
    const coords = extractCoordinates(location_input);
    const payload: any = { days: days || 7 };
    
    if (coords) {
      payload.lat = coords.lat;
      payload.lon = coords.lon;
    } else {
      payload.city = location_input;
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase.functions.invoke('get_weather_forecast_consolidated', {
      body: payload
    });

    if (error) {
      console.error("[Tools] Error fetching weather:", error);
      return { success: false, error: 'Falha ao buscar previsão do tempo: ' + error.message };
    }

    return { success: true, results: JSON.stringify(data) };
  },
});

// 5. Video Analysis
export const analyzeVideo = tool({
  description: 'Analyze a video using AI vision models. Provide a video URL and optional specific question about the video content.',
  parameters: z.object({
    videoUrl: z.string().describe('The public URL of the video to analyze.'),
    question: z.string().optional().describe('Specific question about the video (optional).'),
  }),
  execute: async ({ videoUrl, question }) => {
    try {
      const prompt = question || 'Analyze this video in detail. Describe what happens, identify objects, people, actions, text, and any other relevant information. Provide a comprehensive summary in Portuguese.';

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'video', video: { url: videoUrl } },
              ],
            },
          ],
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[VideoTool] API error:', response.status, errorData);
        return { success: false, error: `Failed to analyze video: ${response.status}` };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || 'No analysis returned';

      return { success: true, results: content };
    } catch (error) {
      console.error('[VideoTool] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
});

// 6. Create Document
export const createDocument = tool({
  description: 'Criar um novo documento no sistema (salvo em cuca.documentos). O agente pode criar documentos livremente sem necessidade de confirmação.',
  parameters: z.object({
    title: z.string().describe('Título do documento a ser criado.'),
    content: z.string().describe('Conteúdo do documento (texto, markdown, JSON, etc).'),
    type: z.string().optional().describe('Tipo do documento (ex: txt, markdown, json, csv). Padrão: markdown.'),
    usuario_id: z.string().optional().describe('UUID do usuário (preenchido automaticamente pelo sistema).')
  }),
  execute: async ({ title, content, type = 'markdown', usuario_id }) => {
    const supabase = getServiceSupabase();
    try {
      const { data, error } = await supabase
        .schema('cuca')
        .from('documentos')
        .insert({
          doc_usuario_id: usuario_id || null,
          doc_nome: title,
          doc_tipo: type,
          doc_conteudo: content,
        })
        .select('doc_id, doc_nome')
        .single();

      if (error) {
        console.error('[CreateDocument] Error:', error);
        return { success: false, error: 'Falha ao criar documento.' };
      }

      return { success: true, doc_id: data.doc_id, doc_nome: data.doc_nome };
    } catch (err) {
      console.error('[CreateDocument] Unexpected error:', err);
      return { success: false, error: 'Erro inesperado ao criar documento.' };
    }
  },
});

// 7. Edit Document (requires confirmation)
export const editDocument = tool({
  description: 'Editar documento existente. Primeiro use sem confirmed=true para mostrar preview ao usuário, depois com confirmed=true após confirmação explícita.',
  parameters: z.object({
    document_id: z.string().describe('ID do documento a ser editado.'),
    new_content: z.string().describe('Novo conteúdo que substituirá o conteúdo atual.'),
    reason: z.string().optional().describe('Motivo da edição (exibido ao usuário para confirmação).'),
    confirmed: z.boolean().optional().default(false).describe('Marque true apenas após o usuário confirmar a edição.')
  }),
  execute: async ({ document_id, new_content, reason, confirmed }) => {
    const supabase = getServiceSupabase();
    const { data: existingDoc, error: fetchError } = await supabase
      .schema('cuca')
      .from('documentos')
      .select('doc_nome, doc_conteudo')
      .eq('doc_id', document_id)
      .single();

    if (fetchError || !existingDoc) {
      return { success: false, error: 'Documento não encontrado.' };
    }

    if (!confirmed) {
      return {
        success: true,
        requiresConfirmation: true,
        document_id,
        nome: existingDoc.doc_nome,
        preview_anterior: existingDoc.doc_conteudo,
        preview_novo: new_content,
        motivo: reason || 'Solicitado pelo assistente',
        message: `Deseja confirmar a edição do documento "${existingDoc.doc_nome}"? O conteúdo será substituído. Responda "sim" para confirmar.`
      };
    }

    const { data, error } = await supabase
      .schema('cuca')
      .from('documentos')
      .update({ doc_conteudo: new_content })
      .eq('doc_id', document_id)
      .select('doc_id')
      .single();

    if (error) {
      console.error('[EditDocument] Update error:', error);
      return { success: false, error: 'Falha ao atualizar documento.' };
    }

    return {
      success: true,
      document_id: data.doc_id,
      message: `Documento "${existingDoc.doc_nome}" atualizado com sucesso.`
    };
  },
});

// 8. Invoke Agent (for COORDINATOR to delegate to custom agents)
const toolNameMap: Record<string, string> = {
  'search_memory': 'searchMemory',
  'search_documents': 'searchDocuments',
  'search_web': 'internetSearch',
  'weather': 'weatherForecast',
  'analyze_video': 'analyzeVideo',
  'create_document': 'createDocument',
  'edit_document': 'editDocument',
};

export const invokeAgent = tool({
  description: 'Delegar uma tarefa a um agente customizado existente. Use para consultas especializadas.',
  parameters: z.object({
    agent_id: z.string().describe('ID do agente customizado (UUID).'),
    task: z.string().describe('Tarefa a ser executada pelo agente delegado.')
  }),
  execute: async ({ agent_id, task }) => {
    const supabase = getServiceSupabase();

    const { data: customAgent, error } = await supabase
      .schema('cuca')
      .from('agentes')
      .select('nome, system_prompt, ferramentas')
      .eq('id', agent_id)
      .single();

    if (error || !customAgent) {
      return { success: false, error: 'Agente customizado não encontrado.' };
    }

    const agentFerramentas: string[] = customAgent.ferramentas || [];

    const availableTools: Record<string, unknown> = {};
    const toolRegistry: Record<string, unknown> = {
      searchMemory,
      searchDocuments,
      internetSearch,
      weatherForecast,
      analyzeVideo,
      createDocument,
      editDocument,
    };

    for (const toolValue of agentFerramentas) {
      const toolKey = toolNameMap[toolValue];
      if (toolKey && toolKey in toolRegistry) {
        availableTools[toolKey] = toolRegistry[toolKey];
      }
    }

    const result = await generateText({
      model: openRouter('openai/chatgpt-4o-latest'),
      messages: [{ role: 'user', content: task }],
      system: customAgent.system_prompt,
      tools: availableTools as Record<string, unknown> as Parameters<typeof generateText>[0]['tools'],
      maxSteps: 3,
    } as Parameters<typeof generateText>[0]);

    return {
      success: true,
      agent_name: customAgent.nome,
      result: result.text
    };
  },
});

export const systemTools = {
  searchMemory,
  searchDocuments,
  internetSearch,
  weatherForecast,
  analyzeVideo,
  createDocument,
  editDocument,
  invokeAgent,
};
