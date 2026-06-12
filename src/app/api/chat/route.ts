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
import { listMcpTools, mcpToolsToAiSdk } from '@/lib/mcp';

// Opt out of caching
export const maxDuration = 60;

type OpenRouterErrorInfo = {
  provider: 'openrouter';
  statusCode?: number;
  code: string;
  reason: string;
  userMessage: string;
  technicalMessage?: string;
  retryable: boolean;
};

function extractStatusCodeFromText(text?: string): number | undefined {
  if (!text) return undefined;
  const match = text.match(/\b(401|402|403|408|409|422|429|500|502|503|504)\b/);
  if (!match) return undefined;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractStatusCodeFromUnknown(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
    cause?: { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
    message?: unknown;
  };

  const directStatus = typeof candidate.status === 'number' ? candidate.status : undefined;
  const directStatusCode = typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined;
  const responseStatus = typeof candidate.response?.status === 'number' ? candidate.response.status : undefined;
  const causeStatus = typeof candidate.cause?.status === 'number' ? candidate.cause.status : undefined;
  const causeStatusCode = typeof candidate.cause?.statusCode === 'number' ? candidate.cause.statusCode : undefined;
  const causeResponseStatus = typeof candidate.cause?.response?.status === 'number' ? candidate.cause.response.status : undefined;
  const fromMessage = extractStatusCodeFromText(typeof candidate.message === 'string' ? candidate.message : undefined);

  return directStatus ?? directStatusCode ?? responseStatus ?? causeStatus ?? causeStatusCode ?? causeResponseStatus ?? fromMessage;
}

function mapOpenRouterError(params: {
  statusCode?: number;
  rawMessage?: string;
  fallbackContext?: string;
}): OpenRouterErrorInfo {
  const rawText = `${params.rawMessage ?? ''} ${params.fallbackContext ?? ''}`.toLowerCase();
  const statusCode = params.statusCode ?? extractStatusCodeFromText(params.rawMessage) ?? extractStatusCodeFromText(params.fallbackContext);

  if (statusCode === 401 || statusCode === 403 || rawText.includes('unauthorized') || rawText.includes('invalid api key')) {
    return {
      provider: 'openrouter',
      statusCode,
      code: 'OPENROUTER_AUTH',
      reason: 'Falha de autenticação com OpenRouter (chave inválida/ausente).',
      userMessage: 'Não foi possível autenticar no OpenRouter (401/403). Verifique a chave da API configurada no servidor.',
      technicalMessage: params.rawMessage,
      retryable: false,
    };
  }

  if (statusCode === 402 || rawText.includes('insufficient') || rawText.includes('credit') || rawText.includes('quota exceeded')) {
    return {
      provider: 'openrouter',
      statusCode,
      code: 'OPENROUTER_INSUFFICIENT_CREDITS',
      reason: 'Saldo/créditos insuficientes para usar o modelo selecionado.',
      userMessage: 'Créditos insuficientes no OpenRouter (402). Recarregue saldo ou selecione um modelo com menor custo/gratuito.',
      technicalMessage: params.rawMessage,
      retryable: false,
    };
  }

  if (statusCode === 429 || rawText.includes('rate limit') || rawText.includes('too many requests')) {
    return {
      provider: 'openrouter',
      statusCode,
      code: 'OPENROUTER_RATE_LIMIT',
      reason: 'Limite de requisições atingido temporariamente.',
      userMessage: 'Limite de requisições atingido no OpenRouter (429). Aguarde alguns segundos e tente novamente.',
      technicalMessage: params.rawMessage,
      retryable: true,
    };
  }

  if (statusCode === 502 || statusCode === 503 || statusCode === 504 || rawText.includes('unavailable') || rawText.includes('upstream') || rawText.includes('gateway')) {
    return {
      provider: 'openrouter',
      statusCode,
      code: 'OPENROUTER_MODEL_UNAVAILABLE',
      reason: 'Modelo/provedor temporariamente indisponível.',
      userMessage: 'O modelo está temporariamente indisponível no OpenRouter (502/503/504). Tente novamente ou troque de modelo.',
      technicalMessage: params.rawMessage,
      retryable: true,
    };
  }

  return {
    provider: 'openrouter',
    statusCode,
    code: 'OPENROUTER_UNKNOWN',
    reason: 'Erro não categorizado retornado pelo OpenRouter.',
    userMessage: 'Não foi possível concluir a geração com o modelo selecionado. Verifique a disponibilidade do modelo e tente novamente.',
    technicalMessage: params.rawMessage,
    retryable: true,
  };
}

function parseOpenRouterStreamErrorChunk(chunkText: string): { message: string; statusCode?: number } {
  const trimmed = chunkText.trim();
  const payload = trimmed.startsWith('3:') ? trimmed.slice(2) : trimmed;

  try {
    const parsed = JSON.parse(payload);
    if (typeof parsed === 'string') {
      return { message: parsed, statusCode: extractStatusCodeFromText(parsed) };
    }

    if (parsed && typeof parsed === 'object') {
      const candidate = parsed as { message?: unknown; error?: unknown; status?: unknown; statusCode?: unknown };
      const message =
        typeof candidate.message === 'string'
          ? candidate.message
          : typeof candidate.error === 'string'
            ? candidate.error
            : JSON.stringify(parsed);
      const statusCode =
        typeof candidate.status === 'number'
          ? candidate.status
          : typeof candidate.statusCode === 'number'
            ? candidate.statusCode
            : extractStatusCodeFromText(message);

      return { message, statusCode };
    }
  } catch {
    // fallback below
  }

  return { message: payload, statusCode: extractStatusCodeFromText(payload) };
}

// Helper to safely extract error message from unknown error objects
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro desconhecido';
}

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
    const { messages, selectedModel, selectedAgent, webSearchEnabled, conversationId, attachedFile, projetoId } = body;

    // Get Auth Session
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: Record<string, unknown>) {
            try { cookieStore.set({ name, value, ...options }); } catch {}
          },
          remove(name: string, options: Record<string, unknown>) {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mutableTools = tools as any;
      delete mutableTools.internetSearch;
    }

    // Load MCP tools from user's configured servers
    try {
      const { data: mcpServers } = await supabase
        .schema('cuca')
        .from('mcp_servers')
        .select('mcp_name, mcp_url, mcp_api_key')
        .eq('mcp_usuario_id', userId)
        .eq('mcp_enabled', true);

      if (mcpServers && mcpServers.length > 0) {
        const MAX_MCP_TOOLS = 10;
        // Carregar tools de todos os servidores em paralelo
        const results = await Promise.allSettled(
          mcpServers.map(async (server) => {
            const mcpTools = await listMcpTools(server.mcp_url, server.mcp_api_key);
            const limited = mcpTools.slice(0, MAX_MCP_TOOLS);
            return mcpToolsToAiSdk(limited, server.mcp_url, server.mcp_name);
          })
        );

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const server = mcpServers[i];
          if (result.status === 'fulfilled') {
            Object.assign(tools, result.value);
            console.log(`[Chat API] Loaded ${Object.keys(result.value).length} MCP tools from ${server.mcp_name} (${server.mcp_url})`);
          } else {
            console.error(`[Chat API] Failed to load MCP tools from ${server.mcp_name} (${server.mcp_url}):`, result.reason);
          }
        }
      }
    } catch (err) {
      console.error('[Chat API] Error loading MCP servers:', err);
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
      (modelIdLower.includes(':free') && !isGemini) ||
      isGemini ||
      modelIdLower.includes('llama-3.2-3b') ||
      modelIdLower.includes('mistral-small') ||
      modelIdLower.includes('mistral-small-3.1') ||
      modelIdLower.includes('hunter-alpha') || 
      modelIdLower.includes('gpt-5.4');

    const toolsToUse = disableToolsForModel ? undefined : tools;
    console.log(`[Chat API] Tools state for model "${modelToUse}": ${toolsToUse ? 'ENABLED' : 'DISABLED'}`);

    // Select the correct agent profile (Default to GERAL)
    const agentProfile = AGENT_PROFILES[(selectedAgent as AgentRole) || 'GERAL'];
    let agentCustomSystemPrompt: string | null = null;
    let agentFerramentas: string[] | null = null;

    // Check if selectedAgent is a custom agent (UUID) and load from DB
    if (selectedAgent && !AGENT_PROFILES[selectedAgent as AgentRole]) {
      try {
        const { data: customAgent } = await supabase
          .schema('cuca')
          .from('agentes')
          .select('nome, system_prompt, ferramentas')
          .eq('id', selectedAgent)
          .single();

        if (customAgent) {
          agentCustomSystemPrompt = customAgent.system_prompt;
          agentFerramentas = customAgent.ferramentas;
          console.log(`[Chat API] Using custom agent: ${customAgent.nome} with tools:`, agentFerramentas);
        }
      } catch (err) {
        console.error('[Chat API] Error loading custom agent:', err);
      }
    }

    // Filter tools based on agent's ferramentas array
    if (toolsToUse) {
      // Determine allowed tool keys
      let allowedToolKeys: string[] = [];

      const toolNameMap: Record<string, string> = {
        'search_memory': 'searchMemory',
        'search_documents': 'searchDocuments',
        'search_web': 'internetSearch',
        'weather': 'weatherForecast',
        'analyze_video': 'analyzeVideo',
        'create_document': 'createDocument',
        'edit_document': 'editDocument',
        'invoke_agent': 'invokeAgent',
      };

      if (agentFerramentas) {
        // Custom agent: use its ferramentas array
        // Supports both system tools (mapped via toolNameMap) and MCP tools (mcp_* prefix passed through)
        allowedToolKeys = agentFerramentas
          .map((f: string) => {
            // System tool mapping
            const mapped = toolNameMap[f];
            if (mapped) return mapped;
            // MCP tools: pass through with mcp_ prefix (e.g. "mcp_supabase_query" in ferramentas)
            if (f.startsWith('mcp_')) return f;
            return null;
          })
          .filter(Boolean) as string[];
      } else if (agentProfile?.allowedTools) {
        // Default agent: use its allowedTools from profile
        allowedToolKeys = agentProfile.allowedTools
          .map((f: string) => toolNameMap[f])
          .filter(Boolean) as string[];
      }

      if (allowedToolKeys.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mutableTools = toolsToUse as any;
        for (const key of Object.keys(mutableTools)) {
          // Sempre preservar tools MCP (servidores externos habilitados pelo usuário)
          if (key.startsWith('mcp_')) continue;
          if (!allowedToolKeys.includes(key)) {
            delete mutableTools[key];
          }
        }
        console.log(`[Chat API] Agent tools filtered to:`, allowedToolKeys);
      }
    }

    // The system prompt controls the core behavior of Cuca AI
    const basePrompt = "Voce e o Cuca AI, um AI Workspace pessoal e segundo cerebro do usuario. " +
      "Voce possui memoria permanente, pode pesquisar na internet e analisar documentos. " +
      "Sempre em portugues, a menos que solicitado o contrario. " +
      "PREVISAO DO TEMPO: Se o usuario pedir previsao do tempo, e fornecer coordenadas (decimal ou DMS) ou uma cidade, acione a ferramenta weatherForecast. " +
      "Ao interpretar a resposta, nunca invente dados. Se a ferramenta indicar fallback para a cidade mais proxima (fallback_used: true), inclua no texto da resposta explicitamente: Usei a cidade mais proxima como fallback: [cidade].";

    // Dynamically list available MCP tools in the system prompt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mcpToolNames = Object.keys(tools).filter((k) => k.startsWith('mcp_'));
    let mcpPromptSection = '';
    if (mcpToolNames.length > 0) {
      const mcpList = mcpToolNames
        .map((key) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const t = (tools as any)[key];
          const desc = t.description || 'Sem descricao';
          return '- ' + key + ': ' + desc;
        })
        .join('\n');
      mcpPromptSection = [
        '',
        'FERRAMENTAS MCP EXTERNAS:',
        'Voce possui ferramentas externas conectadas via MCP (Model Context Protocol).',
        'Use-as SEMPRE que a pergunta do usuario se relacionar com a funcionalidade descrita.',
        'Nao explique que a ferramenta e externa, apenas use-a naturalmente.',
        mcpList,
      ].join('\n');
    }

    const systemPrompt = agentCustomSystemPrompt
      ? (basePrompt + mcpPromptSection + "\n\nPERFIL ATUAL: " + agentCustomSystemPrompt)
      : (basePrompt + mcpPromptSection + "\n\nPERFIL ATUAL: " + agentProfile.name + "\n" + agentProfile.systemPrompt);

    // 1. Semantic Cache Check - Return early if we have a cached response
    if (isUserMessage && typeof textQuery === 'string') {
      const cachedResponse = await checkSemanticCache(textQuery).catch(() => null);
      if (cachedResponse?.resposta) {
        console.log(`[Cache Hit] Similarity: ${cachedResponse.similaridade} - Returning cached response`);

        // Persist the cached response as the assistant message
        const jobId = generateJobId();
        if (activeConversationId) {
          const { data: placeholder } = await supabase
            .schema('cuca')
            .from('mensagens')
            .insert({
              men_conversa_id: activeConversationId,
              men_papel: 'assistant',
              men_conteudo: cachedResponse.resposta,
              men_modelo: modelToUse,
              men_status: 'done',
              men_job_id: jobId,
            })
            .select('men_id')
            .single();

          if (placeholder) {
            // Update conversation timestamp
            await supabase
              .schema('cuca')
              .from('conversas')
              .update({ con_atualizado_em: new Date().toISOString() })
              .eq('con_id', activeConversationId);
          }
        }

        // Return cached response as a stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const textChunk = `0:${JSON.stringify(cachedResponse.resposta)}\n`;
            controller.enqueue(encoder.encode(textChunk));
            const finishChunk = `d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`;
            controller.enqueue(encoder.encode(finishChunk));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'x-cache-hit': 'true',
          },
        });
      }
    }

    // 2. Persist user message and ensure conversation exists
    if (isUserMessage && !activeConversationId) {
      // Create new conversation
      const convData: Record<string, unknown> = {
        con_usuario_id: userId,
        con_titulo: textQuery.substring(0, 100),
      };

      if (selectedAgent) {
        const { data: convProj } = await supabase
          .schema('cuca')
          .from('conversas')
          .insert(convData)
          .select('con_id')
          .single();

        if (convProj) {
          activeConversationId = convProj.con_id;
        }
      } else {
        const { data: newConv, error: convError } = await supabase
          .schema('cuca')
          .from('conversas')
          .insert(convData)
          .select('con_id')
          .single();

        if (convError) {
          console.error('[Chat API] Error creating conversation:', convError);
        } else {
          activeConversationId = newConv.con_id;
        }
      }
    }

    // Persist user message
    const contentToPersist = rawTextQuery;
    if (activeConversationId && isUserMessage) {
      await supabase
        .schema('cuca')
        .from('mensagens')
        .insert({
          men_conversa_id: activeConversationId,
          men_papel: 'user',
          men_conteudo: contentToPersist,
          men_modelo: modelToUse,
          men_status: 'done',
        });

      // Update conversation timestamp
      await supabase
        .schema('cuca')
        .from('conversas')
        .update({ con_atualizado_em: new Date().toISOString() })
        .eq('con_id', activeConversationId);
    }

    // 3. Assemble RAG context (memories + documents)
    const { memories, documents } = await assembleContext(textQuery, userId, activeConversationId || undefined).catch(() => ({ memories: '', documents: '' }));

    let ragContext = '';
    if (memories || documents) {
      ragContext = 'CONTEXTO RELEVANTE (memorias e documentos do usuario):\n';
      if (memories) ragContext += memories + '\n';
      if (documents) ragContext += documents + '\n';
    }

    // Fetch project system prompt if this conversation belongs to a project
    let projectSystemPrompt: string | null = null;
    if (activeConversationId) {
      try {
        const { data: convData } = await supabase
          .schema('cuca')
          .from('conversas')
          .select('con_projeto_id')
          .eq('con_id', activeConversationId)
          .single();

        if (convData?.con_projeto_id) {
          const { data: projectData } = await supabase
            .schema('cuca')
            .from('projetos')
            .select('pro_system_prompt')
            .eq('pro_id', convData.con_projeto_id)
            .single();

          if (projectData?.pro_system_prompt) {
            projectSystemPrompt = projectData.pro_system_prompt;
          }
        }
      } catch (err) {
        console.error('[Chat API] Error fetching project context:', err);
      }
    }

    const enhancedSystemPrompt = projectSystemPrompt
      ? `${systemPrompt}\n\nCONTEXTO DO PROJETO ATUAL:\n${projectSystemPrompt}`
      : systemPrompt;

    const fullSystemPrompt = `${enhancedSystemPrompt}\n\n${ragContext}`;

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
          runMemoryManager(messages, text, userId, null).catch(() => {});
          runSelfReflection(textQuery, text).catch(() => {});
          runKnowledgeGraphManager(textQuery, text).catch(() => {});
        }
      } catch (err: unknown) {
        console.error('[Chat API] Exception in handleFinish:', getErrorMessage(err));
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
        const maybeMessageWithParts = messages[messages.length - 1] as Record<string, unknown>;
        if ('parts' in maybeMessageWithParts) {
          delete maybeMessageWithParts.parts;
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
      } catch (err: unknown) {
        console.error('[Chat API] Could not fetch image for vision, using URL fallback:', getErrorMessage(err));
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
    // Tentativa principal com ferramentas habilitadas
    result = await streamText(streamOptions);
  } catch (primaryError: unknown) {
    // Primeiro erro – tenta novamente sem ferramentas e com um passo apenas
    const primaryMessage = primaryError instanceof Error ? primaryError.message : 'Erro desconhecido';
    console.error('[Chat API] Primary streamText failed, retrying without tools:', primaryMessage);

    try {
      result = await streamText({
        ...streamOptions,
        tools: undefined,
        maxSteps: 1,
      });
    } catch (fallbackError: unknown) {
      // Mapeia o erro para formato estruturado
      const statusCode = extractStatusCodeFromUnknown(fallbackError) ?? extractStatusCodeFromUnknown(primaryError);
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : undefined;
      const mappedError = mapOpenRouterError({
        statusCode,
        rawMessage: fallbackMessage ?? primaryMessage,
        fallbackContext: `model=${modelToUse}`,
      });

      // Atualiza placeholder no DB com mensagem amigável
      if (assistantPlaceholderId) {
        await supabase
          .schema('cuca')
          .from('mensagens')
          .update({ men_status: 'error', men_conteudo: mappedError.userMessage })
          .eq('men_id', assistantPlaceholderId);
      }

      // Resposta JSON contendo detalhes completos do erro
      return NextResponse.json(
        {
          error: mappedError.userMessage,
          provider: mappedError.provider,
          code: mappedError.code,
          reason: mappedError.reason,
          statusCode: mappedError.statusCode,
          technicalMessage: mappedError.technicalMessage,
          retryable: mappedError.retryable,
        },
        {
          status: mappedError.statusCode ?? 502,
          headers: {
            'x-openrouter-error': mappedError.code,
            'x-openrouter-error-reason': mappedError.reason,
            'x-openrouter-status': String(mappedError.statusCode ?? 0),
          },
        }
      );
    }
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
                  try { controller.close(); } catch {}
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

                      const parsedError = parseOpenRouterStreamErrorChunk(text);
                      const mappedError = mapOpenRouterError({
                        statusCode: parsedError.statusCode,
                        rawMessage: parsedError.message,
                        fallbackContext: `model=${modelToUse}`,
                      });

                      // Build a user-friendly assistant message instead of forwarding the raw error
                      const friendlyMessage = `⚠️ **Falha ao consultar o OpenRouter com o modelo \`${modelToUse}\`.**\n\n**Motivo:** ${mappedError.reason}\n**Código:** ${mappedError.statusCode ?? 'não informado'} (${mappedError.code})\n\n${mappedError.userMessage}\n\n${mappedError.retryable ? 'Você pode tentar novamente em instantes ou escolher outro modelo.' : 'Ajuste a configuração/conta e tente novamente.'}`;

                      // Save the friendly message to the DB placeholder
                      if (assistantPlaceholderId) {
                        supabase.schema('cuca').from('mensagens')
                          .update({ men_status: 'done', men_conteudo: friendlyMessage })
                          .eq('men_id', assistantPlaceholderId)
                          .then(() => {});
                      }

                      // Enqueue friendly text chunks instead of the raw error
                      try { controller.enqueue(buildFriendlyErrorChunks(friendlyMessage)); } catch {}
                      try { controller.close(); } catch {}
                      return; // stop the pump — we're done
                    }
                  }
                  controller.enqueue(value);
                } catch {
                  // If enqueue fails (e.g. client closed the connection),
                  // we catch it and KEEP reading.
                  clientDisconnected = true;
                }
              }
            } catch (err) {
               if (!clientDisconnected) {
                 try { controller.error(err); } catch {}
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
      } catch (err: unknown) {
        const errorWithKeys = err && typeof err === 'object' ? Object.getOwnPropertyNames(err) : [];
        console.error('[after()] Background process error:', getErrorMessage(err));
        console.error('[after()] Full error details:', JSON.stringify(err, errorWithKeys, 2));
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
    response.headers.set('x-openrouter-error', 'none');
    response.headers.set('x-openrouter-status', '0');
    return response;
  } catch (error: unknown) {
    console.error('Error in chat route:', getErrorMessage(error));
    const mappedError = mapOpenRouterError({
      statusCode: extractStatusCodeFromUnknown(error),
      rawMessage: getErrorMessage(error),
      fallbackContext: 'unhandled route error',
    });

    return NextResponse.json(
      {
        error: mappedError.userMessage,
        provider: mappedError.provider,
        code: mappedError.code,
        reason: mappedError.reason,
        statusCode: mappedError.statusCode,
        technicalMessage: mappedError.technicalMessage,
        retryable: mappedError.retryable,
      },
      {
        status: mappedError.statusCode ?? 500,
        headers: {
          'x-openrouter-error': mappedError.code,
          'x-openrouter-error-reason': mappedError.reason,
          'x-openrouter-status': String(mappedError.statusCode ?? 0),
        },
      }
    );
  }
}
