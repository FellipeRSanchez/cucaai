import { tool } from 'ai';
import { z } from 'zod';
import { getServiceSupabase } from './supabase';
import { generateEmbedding } from './embeddings';

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

export const systemTools = {
  searchMemory,
  searchDocuments,
  internetSearch,
  weatherForecast,
};
