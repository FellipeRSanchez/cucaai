import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { createOpenAI } from '@ai-sdk/openai';
import { embed } from 'ai';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const openRouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY!,
    headers: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Cuca AI',
    }
  });

  const testTexts = ['Qual o meu nome?', 'O usuário se chama Fellipe'];
  
  for (const text of testTexts) {
    console.log(`\n--- Testing: "${text}" ---`);
    const { embedding: qEmb } = await embed({
      model: openRouter.embedding('openai/text-embedding-3-small'),
      value: text,
    });
    
    const embeddingStr = `[${qEmb.join(',')}]`;
    const { data, error } = await supabase.rpc('match_memorias', {
      query_embedding: embeddingStr,
      p_user_id: '9994a282-bad1-48bd-ab8f-e1ff60d6c769',
      match_threshold: 0.3,
      match_count: 10
    });

    console.log(`  RPC error: ${error?.message ?? 'none'}`);
    console.log(`  RPC results: ${data ? data.length : 0}`);
    if (data && data.length > 0) {
      data.forEach((r: { mem_conteudo: string; similarity: number }) => {
        console.log(`  - [${r.similarity.toFixed(4)}] ${r.mem_conteudo}`);
      });
    }
  }
}

main().catch(console.error);
