import { generateText } from 'ai';
import { openRouter } from './openrouter';
import { getServiceSupabase } from './supabase';
import { generateEmbedding } from './embeddings';

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
export async function runMemoryManager(userMessage: string, assistantResponse: string) {
  try {
    const analysis = await generateText({
      model: openRouter('openai/gpt-4o-mini'), // Usar um modelo rápido e barato para essa tarefa 
      system: MEMORY_MANAGER_PROMPT,
      prompt: `Última mensagem do usuário: "${userMessage}"\n\nResposta do Assistant: "${assistantResponse}"`
    });

    const memoryContent = analysis.text.trim();

    // If it decided there's nothing permanent to save, stop.
    if (memoryContent === 'NADA' || memoryContent.length < 5) {
      return;
    }

    // Convert the extracted facts into individual statements
    const facts = memoryContent.split(';').map(f => f.trim()).filter(f => f.length > 0);

    const supabase = getServiceSupabase();

    for (const fact of facts) {
      console.log('🧠 [Memory Manager] Extracting fact:', fact);
      const embedding = await generateEmbedding(fact);
      const embeddingStr = `[${embedding.join(',')}]`;

      const { error } = await supabase.schema('cuca').from('memorias').insert({
        mem_conteudo: fact,
        mem_embedding: embeddingStr,
        mem_tipo: 'LTM', // Long Term Memory
        mem_importancia: 0.8, // Default threshold, could be dynamically calculated by the agent
        mem_origem: 'System/MemoryManager'
      });

      if (error) {
        console.error('Failed to save memory fact:', error);
      }
    }

  } catch (error) {
    console.error('Error running memory manager:', error);
  }
}
