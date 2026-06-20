import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { createOpenAI } from '@ai-sdk/openai';
import { embedMany } from 'ai';

const BATCH_SIZE = 20;

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

  const { data: memories, error } = await supabase
    .schema('cuca')
    .from('memorias')
    .select('mem_id, mem_conteudo')
    .is('mem_embedding', null);

  if (error || !memories) {
    console.error('Failed to fetch memories:', error);
    process.exit(1);
  }

  console.log(`Found ${memories.length} memories without embeddings`);

  for (let i = 0; i < memories.length; i += BATCH_SIZE) {
    const batch = memories.slice(i, i + BATCH_SIZE);
    const texts = batch.map((m: { mem_conteudo: string }) => m.mem_conteudo);

    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(memories.length / BATCH_SIZE)} (${batch.length} items)`);

    try {
      const { embeddings } = await embedMany({
        model: openRouter.embedding('openai/text-embedding-3-small'),
        values: texts,
      });

      for (let j = 0; j < batch.length; j++) {
        const embeddingStr = `[${embeddings[j].join(',')}]`;
        const { error: updateError } = await supabase
          .schema('cuca')
          .from('memorias')
          .update({ mem_embedding: embeddingStr })
          .eq('mem_id', (batch[j] as { mem_id: string }).mem_id);

        if (updateError) {
          console.error(`Failed to update ${batch[j].mem_id}:`, updateError);
        } else {
          console.log(`  ✓ Updated ${batch[j].mem_id}`);
        }
      }
    } catch (err) {
      console.error(`Batch failed:`, err);
    }
  }

  console.log('Done!');
}

main().catch(console.error);
