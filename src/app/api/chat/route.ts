import { openRouter } from '@/lib/openrouter';
import { streamText } from 'ai';
import { after } from 'next/server';
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

/** Generate a simple UUID-like string for job tracking */
function generateJobId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[Chat API] Received request with model:', body.selectedModel);
    const { messages, selectedModel, selectedAgent, webSearchEnabled, conversationId, attachedFile } = body;

    // Get Auth Session
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) {
            try { cookieStore.set({ name, value, ...options }); } catch {}
          },
          remove(name: string, options: any) {
            try { cookieStore.set({ name, value: '', ...options }); } catch {}
          },
        },
      }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error('[Chat API] Auth error or no user found:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const supabase = getServiceSupabase();
    let activeConversationId = conversationId;

    // Filter tools based on user preference
    const tools = { ...systemTools };
    if (!webSearchEnabled) {
      delete (tools as any).internetSearch;
    }

    const lastMessage = messages[messages.length - 1];
    const rawTextQuery = lastMessage?.content || '';
    
    // Clean markdown attachments from the query for RAG and Cache
    const textQuery = rawTextQuery.replace(/!\[.*?\]\(.*?\)|\[Arquivo Anexado: .*?\]/g, '').trim();
    
    const isUserMessage = lastMessage?.role === 'user';
    const modelToUse = selectedModel || 'openai/chatgpt-4o-latest';

    // Some models (especially free/community) fail with tool calling.
    const modelIdLower = (selectedModel || '').toLowerCase();
    const isGemini = modelIdLower.includes('gemini');
    
    const disableToolsForModel =
      (modelIdLower.includes(':free') && !isGemini) || // Allow tools for Gemini even if free
      modelIdLower.includes('llama-3.2-3b') ||
      modelIdLower.includes('mistral-small') ||
      modelIdLower.includes('mistral-small-3.1') ||
      modelIdLower.includes('hunter-alpha') || 
      modelIdLower.includes('gpt-5.4');

    const toolsToUse = disableToolsForModel ? undefined : tools;
    console.log(`[Chat API] Tools state for model "${modelToUse}": ${toolsToUse ? 'ENABLED' : 'DISABLED'}`);

    // Select the correct agent profile (Default to GERAL)
    const agentProfile = AGENT_PROFILES[(selectedAgent as AgentRole) || 'GERAL'];

    // The system prompt controls the core behavior of Cuca AI
    const basePrompt = `Você é o Cuca AI, um AI Workspace pessoal e segundo cérebro do usuário.
Você possui memória permanente, pode pesquisar na internet e analisar documentos.
Sempre em português, a menos que solicitado o contrário.

PREVISÃO DO TEMPO:
Se o usuário pedir previsão do tempo (ex: "vai chover?", "clima em [X]"), e fornecer coordenadas (decimal ou DMS) ou uma cidade, acione a ferramenta \`weatherForecast\`.
Ao interpretar a resposta, nunca invente dados. Se a ferramenta indicar fallback para a cidade mais próxima (fallback_used: true), inclua no texto da resposta explicitamente: "Usei a cidade mais próxima como fallback: [cidade]".`;

    const systemPrompt = `${basePrompt}\n\nPERFIL ATUAL: ${agentProfile.name}\n${agentProfile.systemPrompt}`;

    

    // 1. Semantic Cache Check
    if (isUserMessage && typeof textQuery === 'string') {
      const cachedResponse = await checkSemanticCache(textQuery).catch(() => null);
      if (cachedResponse) console.log(`[Cache Hit] Similarity: ${cachedResponse.similaridade}`);
    }

    // 2. Persist User Message to DB
    if (isUserMessage) {
      if (!activeConversationId) {
        const { data: newConv, error: convError } = await supabase
          .schema('cuca')
          .from('conversas')
          .insert({
            con_usuario_id: userId,
            con_titulo: textQuery.substring(0, 50) + (textQuery.length > 50 ? '...' : '')
          })
          .select()
          .single();

        if (convError) console.error('Error creating conversation:', convError);
        else activeConversationId = newConv.con_id;
      }

      // The client already appends the markdown to the content, so we just use rawTextQuery
      let contentToPersist = rawTextQuery;

      if (activeConversationId) {
        await supabase
          .schema('cuca')
          .from('mensagens')
          .insert({
            men_conversa_id: activeConversationId,
            men_papel: 'user',
            men_conteudo: contentToPersist
          });
      }
    }

    // 3. Assemble Context (RAG)
    const { memories, documents } = await assembleContext(textQuery, userId);

    const ragContext = `
---
CONTEXTO DE MEMÓRIA PERMANENTE:
${memories}

CONTEXTO DE DOCUMENTOS:
${documents}
---
`;

    const fullSystemPrompt = `${systemPrompt}\n\n${ragContext}`;

    // 4. Generate a jobId for background tracking
    const jobId = generateJobId();

    // 5. Create a "pending" placeholder for the assistant response
    let assistantPlaceholderId: string | null = null;
    if (activeConversationId && isUserMessage) {
      const { data: placeholder, error: placeholderError } = await supabase
        .schema('cuca')
        .from('mensagens')
        .insert({
          men_conversa_id: activeConversationId,
          men_papel: 'assistant',
          men_conteudo: '',
          men_modelo: modelToUse,
          men_status: 'pending',
          men_job_id: jobId,
        })
        .select('men_id')
        .single();

      if (!placeholderError && placeholder) {
        assistantPlaceholderId = placeholder.men_id;
      } else {
        console.error('[Chat API] Error creating assistant placeholder:', placeholderError?.message);
      }
    }

    // 6. Call AI logic
    const handleFinish = async (text: string) => {
      console.log('[Chat API] Completing job:', jobId);
      try {
        if (assistantPlaceholderId && text) {
          await supabase
            .schema('cuca')
            .from('mensagens')
            .update({
              men_conteudo: text,
              men_status: 'done',
            })
            .eq('men_id', assistantPlaceholderId);
        }

        if (activeConversationId) {
          await supabase
            .schema('cuca')
            .from('conversas')
            .update({ con_atualizado_em: new Date().toISOString() })
            .eq('con_id', activeConversationId);
        }

        if (isUserMessage && text) {
          await saveToSemanticCache(textQuery, text, modelToUse).catch(() => {});
          runMemoryManager(messages, text, userId).catch(() => {});
          runSelfReflection(textQuery, text).catch(() => {});
          runKnowledgeGraphManager(textQuery, text).catch(() => {});
        }
      } catch (err: any) {
        console.error('[Chat API] Exception in handleFinish:', err.message);
      }
    };

    // 6.5 Final Message Format for AI (Vision support) - Do it at the last possible moment
    if (isUserMessage && attachedFile?.type === 'image' && attachedFile.url) {
      try {
        console.log('[Chat API] Fetching image for vision processing:', attachedFile.url);
        const imageRes = await fetch(attachedFile.url);
        if (!imageRes.ok) throw new Error(`HTTP error ${imageRes.status}`);
        
        const imageBuffer = await imageRes.arrayBuffer();
        const imageUint8Array = new Uint8Array(imageBuffer);
        
        // Clean up any existing parts to avoid conflicts
        if ((messages[messages.length - 1] as any).parts) {
          delete (messages[messages.length - 1] as any).parts;
        }

        messages[messages.length - 1].content = [
          { type: 'text', text: textQuery },
          { 
            type: 'image', 
            image: imageUint8Array,
            mimeType: attachedFile.name.endsWith('.png') ? 'image/png' : 'image/jpeg'
          }
        ];
        console.log('[Chat API] Using Uint8Array with MIME type for image recognition');
      } catch (err: any) {
        console.error('[Chat API] Could not fetch image for vision, using URL fallback:', err.message);
        messages[messages.length - 1].content = [
          { type: 'text', text: textQuery },
          { type: 'image', image: attachedFile.url }
        ];
      }
    }

    let result;
    const streamOptions = {
      model: openRouter(modelToUse),
      messages,
      system: fullSystemPrompt,
      tools: toolsToUse,
      maxSteps: 5,
      onFinish: async ({ text }: { text: string }) => {
        await handleFinish(text);
      }
    };

    try {
      result = await streamText(streamOptions);
    } catch (primaryError: any) {
      console.error('[Chat API] Primary streamText failed, retrying without tools:', primaryError.message);
      result = await streamText({
        ...streamOptions,
        tools: undefined,
        maxSteps: 1,
      });
    }

    // 7. Use a custom ReadableStream to bypass client disconnect cancellation
    const sdkResponse = result.toDataStreamResponse();
    const originalStream = sdkResponse.body as ReadableStream;
    let clientDisconnected = false;

    const encoder = new TextEncoder();

    // Helper to build an AI SDK data-stream friendly text response
    const buildFriendlyErrorChunks = (message: string): Uint8Array => {
      const textChunk = `0:${JSON.stringify(message)}\n`;
      const finishChunk = `d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`;
      return encoder.encode(textChunk + finishChunk);
    };

    const proxyStream = new ReadableStream({
      start(controller) {
        const reader = originalStream.getReader();

        // Background pump that consumes the AI stream fully
        const pump = async () => {
          while (true) {
            try {
              const { done, value } = await reader.read();
              if (done) {
                if (!clientDisconnected) {
                  try { controller.close(); } catch (e) {}
                }
                break;
              }
              
              if (!clientDisconnected) {
                try {
                  if (value) {
                    // Decode and inspect the chunk for error signals (3:"...") from OpenRouter
                    const text = new TextDecoder().decode(value);
                    
                    if (text.trim().startsWith('3:')) {
                      // This is an error chunk from OpenRouter/model.
                      console.error(`[Chat API] OpenRouter stream error for model "${modelToUse}": ${text.trim()}`);

                      // Build a user-friendly assistant message instead of forwarding the raw error
                      const friendlyMessage = `⚠️ **O modelo \`${modelToUse}\` não conseguiu processar sua mensagem.**\n\nPossíveis causas:\n- **Saldo insuficiente** no OpenRouter para este modelo\n- Modelo temporariamente indisponível ou fora do ar\n- Limite de requisições atingido\n\nSugestões:\n- Recarregue seus créditos em [openrouter.ai/settings/credits](https://openrouter.ai/settings/credits)\n- Escolha um modelo diferente (como **GPT-4o**, **Claude** ou um modelo gratuito)`;

                      // Save the friendly message to the DB placeholder
                      if (assistantPlaceholderId) {
                        supabase.schema('cuca').from('mensagens')
                          .update({ men_status: 'done', men_conteudo: friendlyMessage })
                          .eq('men_id', assistantPlaceholderId)
                          .then(() => {});
                      }

                      // Enqueue friendly text chunks instead of the raw error
                      try { controller.enqueue(buildFriendlyErrorChunks(friendlyMessage)); } catch(e) {}
                      try { controller.close(); } catch(e) {}
                      return; // stop the pump — we're done
                    }
                  }
                  controller.enqueue(value);
                } catch (err) {
                  // If enqueue fails (e.g. client closed the connection),
                  // we catch it and KEEP reading.
                  clientDisconnected = true;
                }
              }
            } catch (err) {
               if (!clientDisconnected) {
                 try { controller.error(err); } catch (e) {}
               }
               break;
            }
          }
        };

        // Run the pump without awaiting it in the start() method
        pump();
      },
      cancel() {
        // IMPORTANT: The client disconnected.
        // We DO NOT cancel the upstream because we want the model to finish generating in the background.
        clientDisconnected = true;
      }
    });

    // 8. Ensure `after()` waits for the result text to finish saving
    after(async () => {
      try {
        await result.text; // Ensures stream generation waits on the server
        console.log('[after()] Stream generation successfully finalized in background');
      } catch (err: any) {
        console.error('[after()] Background process error:', err.message);
        console.error('[after()] Full error details:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        if (assistantPlaceholderId) {
          await supabase
            .schema('cuca')
            .from('mensagens')
            .update({ men_status: 'error', men_conteudo: '[Erro ao processar resposta]' })
            .eq('men_id', assistantPlaceholderId);
        }
      }
    });

    // 9. Return response with copied headers
    const response = new Response(proxyStream, {
      status: sdkResponse.status,
      statusText: sdkResponse.statusText,
      headers: sdkResponse.headers
    });

    if (activeConversationId) {
      response.headers.set('x-conversation-id', activeConversationId);
    }
    response.headers.set('x-job-id', jobId);
    return response;
  } catch (error: any) {
    console.error('Error in chat route:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
