import { openRouter } from '@/lib/openrouter';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { checkSemanticCache, saveToSemanticCache } from '@/services/semanticCache';
import { AGENT_PROFILES, AgentRole } from '@/lib/agents';
import { systemTools } from '@/lib/tools';
import { runMemoryManager } from '@/lib/memoryManager';
import { runSelfReflection } from '@/lib/selfReflection';
import { assembleContext } from '@/lib/contextAssembler';
import { runKnowledgeGraphManager } from '@/lib/knowledgeGraph';
import { getServiceSupabase } from '@/lib/supabase';

// Opt out of caching
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[Chat API] Received request:', body);
    const { messages, selectedModel, selectedAgent, webSearchEnabled, conversationId } = body;

    // Get Auth Session
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // The `remove` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    const { data: { session } } = await supabaseAuth.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const supabase = getServiceSupabase();
    let activeConversationId = conversationId;

    // Filter tools based on user preference
    const tools = { ...systemTools };
    if (!webSearchEnabled) {
      delete (tools as any).internetSearch;
    }

    // Select the correct agent profile (Default to GERAL)
    const agentProfile = AGENT_PROFILES[(selectedAgent as AgentRole) || 'GERAL'];

    // The system prompt controls the core behavior of Cuca AI
    const basePrompt = `Você é o Cuca AI, um AI Workspace pessoal e segundo cérebro do usuário.
Você possui memória permanente, pode pesquisar na internet e analisar documentos.
Sempre em português, a menos que solicitado o contrário.`;

    const systemPrompt = `${basePrompt}\n\nPERFIL ATUAL: ${agentProfile.name}\n${agentProfile.systemPrompt}`;

    const lastMessage = messages[messages.length - 1];
    const isUserMessage = lastMessage?.role === 'user';
    const modelToUse = selectedModel || 'openai/chatgpt-4o-latest';

    // 1. Semantic Cache Check (Somente se for mensagem do usuário)
    if (isUserMessage) {
      const userQuery = lastMessage.content;
      console.log('[Chat API] Checking semantic cache for:', userQuery);
      
      const cachedResponse = await checkSemanticCache(userQuery).catch(err => {
        console.error('[Chat API] Semantic cache error:', err);
        return null;
      });
      
      if (cachedResponse) {
        console.log(`[Cache Hit] Similarity: ${cachedResponse.similaridade}`);
        
        // We'll return a simulated stream response just to follow the app's standard flow
        const encoder = new TextEncoder();
        const customStream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`0:"${cachedResponse.resposta.replace(/"/g, '\\"')}"\n`));
            controller.close();
          }
        });

        // Persist the user message and cached response if possible
        // (Implementation detail: we could create a background task for this too)

        return new Response(customStream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'x-vercel-ai-data-stream': 'v1',
          },
        });
      }
    }

    // 2. Persist User Message to DB
    if (isUserMessage) {
      // Ensure conversation exists
      if (!activeConversationId) {
        const { data: newConv, error: convError } = await supabase
          .schema('cuca')
          .from('conversas')
          .insert({
            con_usuario_id: userId,
            con_titulo: lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '')
          })
          .select()
          .single();
        
        if (convError) console.error('Error creating conversation:', convError);
        else activeConversationId = newConv.con_id;
      }

      // Save Message
      if (activeConversationId) {
        const { error: msgError } = await supabase
          .schema('cuca')
          .from('mensagens')
          .insert({
            men_conversa_id: activeConversationId,
            men_papel: 'user',
            men_conteudo: lastMessage.content
          });
        
        if (msgError) console.error('Error saving user message:', msgError);
      }
    }

    // 3. Assemble Context (RAG)
    const userQuery = lastMessage.content;
    const { memories, documents } = await assembleContext(userQuery);

    const ragContext = `
---
CONTEXTO DE MEMÓRIA PERMANENTE:
${memories}

CONTEXTO DE DOCUMENTOS:
${documents}
---
`;

    const fullSystemPrompt = `${systemPrompt}\n\n${ragContext}`;

    // 4. Call AI logic if no cache hit
    console.log('[Chat API] Calling AI Model:', modelToUse);
    const result = await streamText({
      model: openRouter(modelToUse),
      messages,
      system: fullSystemPrompt,
      tools: tools,
      maxSteps: 5, // Allow the agent to call multiple tools before responding
      onFinish: async ({ text }) => {
        // Save Assistant response to DB
        if (activeConversationId && text) {
          const { error: assistantMsgError } = await supabase
            .schema('cuca')
            .from('mensagens')
            .insert({
              men_conversa_id: activeConversationId,
              men_papel: 'assistant',
              men_conteudo: text
            });
          
          if (assistantMsgError) console.error('Error saving assistant message:', assistantMsgError);
          
          // Update conversation timestamp
          const { error: updateError } = await supabase
            .schema('cuca')
            .from('conversas')
            .update({ con_atualizado_em: new Date().toISOString() })
            .eq('con_id', activeConversationId);
          
          if (updateError) console.error('Error updating conversation timestamp:', updateError);
        }

        // Run in background: Save to Semantic Cache if appropriate
        if (isUserMessage && text) {
          await saveToSemanticCache(lastMessage.content, text, modelToUse);
          
          // Trigger the asynchronous Memory Manager Agent to extract permanent facts
          runMemoryManager(lastMessage.content, text).catch(err => 
            console.error('Memory Manager background task failed:', err)
          );
          
          // Trigger the asynchronous Self Reflection Agent
          runSelfReflection(lastMessage.content, text).catch(err =>
            console.error('Self Reflection background task failed:', err)
          );

          // Trigger the Knowledge Graph Manager to extract entities and relations
          runKnowledgeGraphManager(lastMessage.content, text).catch(err =>
            console.error('Knowledge Graph Manager background task failed:', err)
          );
        }
      }
    });

    // Add conversation ID to headers if it's new
    const response = result.toDataStreamResponse();
    if (activeConversationId) {
      response.headers.set('x-conversation-id', activeConversationId);
    }
    return response;
  } catch (error) {
    console.error('Error in chat route:', error);
    return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 });
  }
}

