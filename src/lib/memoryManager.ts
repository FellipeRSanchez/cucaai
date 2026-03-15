import { generateText } from 'ai';
import { openRouter } from './openrouter';
import { getServiceSupabase } from './supabase';

const MEMORY_MANAGER_PROMPT = `Você é o Memory Manager Agent do Cuca AI.
Sua única função é analisar o último turno de conversa entre o Usuário e o Assistant e decidir se há alguma informação NOVA, IMPORTANTE e PERMANENTE que deve ser lembrada a longo prazo.
Exemplos do que LEMBRAR: 
- Nome do usuário, idade, família.
- Preferências ("gosto de respostas curtas", "sou alérgico a amendoim").
- Fatos estáticos ("eu trabalho na empresa X", "tenho uma fazenda em Y").
- Especialidades técnicas ("programo em React e Python").

Exemplos do que IGNORAR:
- Perguntas genéricas ("quantos meses tem o ano?", "escreva um código de x").
- Saudações ("olá, bom dia").
- Informações altamente temporárias ("estou indo dormir agora").

Se houver algo a lembrar, responda APENAS com uma frase descritiva, clara e em terceira pessoa. 
Exemplo: "O usuário se chama João e trabalha com desenvolvimento de software."
Se houver mais de um fato não relacionado, separe-os por ponto e vírgula.
Se NÃO houver NADA relevante para memória de longo prazo, responda EXATAMENTE com a palavra: NADA.`;

/**
 * Runs asynchronously after the chat response to extract and save permanent memories.
 */
export async function runMemoryManager(userMessage: string, assistantResponse: string, userId?: string) {
  try {
    console.log('🧠 [Memory Manager] Starting with userId:', userId);
    console.log('🧠 [Memory Manager] User message:', userMessage);
    console.log('🧠 [Memory Manager] Assistant response length:', assistantResponse?.length || 0);

    if (!userId) {
      console.error('🧠 [Memory Manager] No userId provided, cannot save memories');
      return;
    }

    const analysis = await generateText({
      model: openRouter('openai/gpt-4o-mini'), // Usar um modelo rápido e barato para essa tarefa 
      system: MEMORY_MANAGER_PROMPT,
      prompt: `Última mensagem do usuário: "${userMessage}"\n\nResposta do Assistant: "${assistantResponse}"`
    });

    const memoryContent = analysis.text.trim();
    console.log('🧠 [Memory Manager] Analysis result:', memoryContent);

    // If it decided there's nothing permanent to save, stop.
    if (memoryContent === 'NADA' || memoryContent.length < 5) {
      console.log('🧠 [Memory Manager] Nothing to save');
      return;
    }

    // Convert the extracted facts into individual statements
    const facts = memoryContent.split(';').map(f => f.trim()).filter(f => f.length > 0);
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
