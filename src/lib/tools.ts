import { tool } from 'ai';
import { z } from 'zod';
import { getServiceSupabase } from './supabase';
import { generateEmbedding } from './embeddings';

/**
 * Common tools that the Agents can use.
 */

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

export const systemTools = {
  searchMemory,
  searchDocuments,
  internetSearch,
};
