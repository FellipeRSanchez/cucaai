import { tavily } from '@tavily/core';

const client = tavily({
  apiKey: process.env.TAVILY_API_KEY,
});

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  console.log(`[WebSearch] Searching for: ${query}`);

  try {
    const response = await client.search(query, {
      searchDepth: 'basic',
      maxResults: 5,
      includeAnswer: false,
    });

    return response.results.map((r) => ({
      title: r.title,
      snippet: r.content,
      url: r.url,
    }));
  } catch (err) {
    console.error('[WebSearch] Tavily error:', err);
    return [];
  }
}
