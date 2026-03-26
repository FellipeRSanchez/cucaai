import { generateText } from 'ai';
import { openRouter } from './openrouter';
import { getServiceSupabase } from './supabase';

const MEMORY_MANAGER_PROMPT = `Você é o Memory Manager Agent do Cuca AI.
Sua função é analisar o contexto recente da conversa e a última resposta do Assistant para extrair informações NOVAS, IMPORTANTES e PERMANENTES sobre o usuário.
Extraia APENAS fatos de longo prazo (quem é o usuário, o que ele faz, suas preferências, histórico pessoal, restrições).

Exemplos do que LEMBRAR: 
- Perfil e família: "O usuário se chama João", "O usuário tem dois filhos".
- Preferências: "O usuário prefere respostas curtas e diretas", "O usuário tem alergia a amendoim".
- Fatos estáticos/Contexto: "O usuário trabalha com marketing na empresa X", "O usuário está aprendendo Rust", "O usuário é programador".

Exemplos do que IGNORAR:
- Perguntas e respostas sobre tarefas do dia a dia ("como centralizar uma div?", "resuma o texto x").
- Saudações, sentimentos ou informações altamente temporárias ("estou cansado hoje", "bom dia", "estou indo dormir").

Regras de Formatação:
1. Responda APENAS com uma frase descritiva, clara e em terceira pessoa para cada fato.
2. Cada fato deve ser CUMULATIVO, INDEPENDENTE e AUTOSSUFICIENTE (ex: "O usuário tem um cachorro chamado Rex", e NÃO apenas "Cachorro Rex").
3. Se houver mais de um fato novo não relacionado, separe-os por ponto e vírgula.
4. Se NÃO houver NADA novo ou relevante para a memória de longo prazo, responda EXATAMENTE com a palavra: NADA. Não utilize pontuação final.`;

/**
 * Runs asynchronously after the chat response to extract and save permanent memories.
 */
export async function runMemoryManager(messages: any[], assistantResponse: string, userId?: string) {
  try {
    console.log('🧠 [Memory Manager] Starting with userId:', userId);
    console.log('🧠 [Memory Manager] Messages length:', messages?.length || 0);
    console.log('🧠 [Memory Manager] Assistant response length:', assistantResponse?.length || 0);

    if (!userId) {
      console.error('🧠 [Memory Manager] No userId provided, cannot save memories');
      return;
    }

    // Build recent conversation context (last 5 messages)
    const recentMessagesContext = messages
      .slice(-5)
      .map(m => `${m.role === 'user' ? 'Usuário' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const analysis = await generateText({
      model: openRouter('openai/gpt-4o-mini'), // Usar um modelo rápido e barato para essa tarefa 
      system: MEMORY_MANAGER_PROMPT,
      prompt: `Histórico Recente da Conversa:\n${recentMessagesContext}\n\nÚltima resposta do Assistant:\n${assistantResponse}`
    });

    const memoryContent = analysis.text.trim();
    console.log('🧠 [Memory Manager] Analysis result:', memoryContent);

    // Normalize for common empty responses
    const normalized = memoryContent.toUpperCase().replace(/[^A-ZÇÃÕÁÉÍÓÚ]/g, ' ').trim();
    const isNada = 
      normalized === 'NADA' || 
      normalized.includes('NADA RELEVANTE') || 
      normalized.includes('NENHUMA INFORMA') || 
      normalized.includes('NAO HA NADA') ||
      memoryContent.length < 5;

    // If it decided there's nothing permanent to save, stop.
    if (isNada) {
      console.log('🧠 [Memory Manager] Nothing to save');
      return;
    }

    // Convert the extracted facts into individual statements
    const facts = memoryContent.split(';').map(f => f.trim()).filter(f => f.length > 5 && f.toUpperCase() !== 'NADA' && f.toUpperCase() !== 'NADA.');
    console.log('🧠 [Memory Manager] Facts to save:', facts);

    const supabase = getServiceSupabase();
    console.log('🧠 [Memory Manager] Supabase client created');

    for (const fact of facts) {
      console.log('🧠 [Memory Manager] Saving fact:', fact);
      console.log('🧠 [Memory Manager] Data to insert:', {
        mem_usuario_id: userId,
        mem_conteudo: fact,
        mem_fonte: 'agent',
        mem_relevancia: 8,
        mem_metadados: {
          origem: 'MemoryManager',
          tipo: 'LTM'
        }
      });

      const { data, error } = await supabase.schema('cuca').from('memorias').insert({
        mem_usuario_id: userId,
        mem_conteudo: fact,
        mem_fonte: 'agent',
        mem_relevancia: 8, // Alta relevância para memórias extraídas automaticamente
        mem_metadados: {
          origem: 'MemoryManager',
          tipo: 'LTM' // Long Term Memory
        }
      }).select();

      if (error) {
        console.error('🧠 [Memory Manager] Failed to save memory fact:', error);
        console.error('🧠 [Memory Manager] Error details:', JSON.stringify(error, null, 2));
      } else {
        console.log('🧠 [Memory Manager] Successfully saved:', data);
      }
    }

  } catch (error) {
    console.error('🧠 [Memory Manager] Error running memory manager:', error);
    console.error('🧠 [Memory Manager] Error stack:', error instanceof Error ? error.stack : 'No stack');
  }
}
