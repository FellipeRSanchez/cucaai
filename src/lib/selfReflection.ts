import { generateText } from 'ai';
import { openRouter } from './openrouter';

const SELF_REFLECTION_PROMPT = `Você é o Self-Reflection Agent do Cuca AI.
Sua missão é avaliar a conversa recente entre o Usuário e o Assistant para determinar se houveram falhas críticas,
respostas alucinadas (inventadas) ou seências não resolvidas que precisariam ser abordadas no próximo contato.

Se a conversa fluiu bem e a necessidade do usuário foi atendida, responda DE FATO com a palavra: OK.
Se houver uma sugestão de melhoria ou correção crítica para a próxima vez que o sistema encontrar o usuário, 
exponha de forma direta, iniciando com "ALERTA:".

Exemplo 1 (Bom):
OK

Exemplo 2 (Ruim):
ALERTA: O Assistente deu uma resposta genérica sobre a biblioteca React mas não resolveu a issue de build.`;

/**
 * Avalia de forma assíncrona a qualidade da interação. 
 * Pode ser armazenada em log ou na tabela da conversa para refinos posteriores.
 */
export async function runSelfReflection(userMessage: string, assistantResponse: string) {
  try {
    const analysis = await generateText({
      model: openRouter('openai/gpt-4o-mini'), 
      system: SELF_REFLECTION_PROMPT,
      prompt: `Usuário disse: "${userMessage}"\n\nAssistant respondeu: "${assistantResponse}"`
    });

    const reflection = analysis.text.trim();

    if (reflection === 'OK' || !reflection.startsWith('ALERTA:')) {
      return; 
    }

    // In a full production system, this could be saved to a "Reflections" table linked to the Conversation ID
    // For MVP, we log this critical warning to console / telemetry
    console.warn(`🕵️‍♂️ [Self-Reflection Flag]: ${reflection}`);

  } catch (error) {
    console.error('Error running self-reflection manager:', error);
  }
}
