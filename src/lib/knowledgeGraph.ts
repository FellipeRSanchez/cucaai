import { getServiceSupabase } from './supabase';
import { generateText } from 'ai';
import { openRouter } from './openrouter';

/**
 * Knowledge Graph Manager
 * Extracts entities and relations from a conversation and saves them to the DB.
 */
export async function runKnowledgeGraphManager(userQuery: string, assistantResponse: string) {
  try {
    const supabase = getServiceSupabase();
    const model = openRouter('openai/gpt-4o-mini'); // Using a small fast model for extraction

    const prompt = `Analise a seguinte conversa e extraia entidades relevantes (Pessoa, Empresa, Conceito, Local, Tecnologia) e suas relações.
Retorne APENAS um JSON no formato:
{
  "entidades": [{"nome": "Nome", "tipo": "Tipo", "descricao": "Breve descrição"}],
  "relacoes": [{"entidade1": "Nome1", "entidade2": "Nome2", "tipo": "tipo_de_relacao"}]
}

CONVERSA:
Usuário: ${userQuery}
Assistente: ${assistantResponse}`;

    const { text } = await generateText({
      model,
      prompt,
    });

    const extraction = JSON.parse(text.replace(/```json|```/g, '').trim());

    // 1. Save Entidades
    for (const ent of extraction.entidades) {
      await supabase.schema('cuca').from('entidades').upsert({
        ent_nome: ent.nome,
        ent_tipo: ent.tipo,
        ent_descricao: ent.descricao
      }, { onConflict: 'ent_nome' });
    }

    // 2. Save Relacoes
    // Relacoes depend of ent_id, so we need to fetch them first or do it carefully
    for (const rel of extraction.relacoes) {
      const { data: e1 } = await supabase.schema('cuca').from('entidades').select('ent_id').eq('ent_nome', rel.entidade1).single();
      const { data: e2 } = await supabase.schema('cuca').from('entidades').select('ent_id').eq('ent_nome', rel.entidade2).single();

      if (e1 && e2) {
        await supabase.schema('cuca').from('relacoes').insert({
          rel_entidade1: e1.ent_id,
          rel_entidade2: e2.ent_id,
          rel_tipo: rel.tipo
        });
      }
    }

    console.log('[KG Manager] Extraction complete for query:', userQuery);
  } catch (error) {
    console.error('Error in Knowledge Graph Manager:', error);
  }
}
