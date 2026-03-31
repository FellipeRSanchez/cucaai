'use client';

import { useChat } from '@ai-sdk/react';
import { useModelsStore } from '@/store/modelsStore';
import { Send, Loader2, Sparkles, User, Bot, RefreshCw, Settings, Cpu, Paperclip, X, WifiOff, Copy, Edit2, Trash2, Globe } from 'lucide-react';
import { useEffect, useRef, useCallback, useState } from 'react';
import clsx from 'clsx';

import { useUIStore } from '@/store/uiStore';
import { useChatStore } from '@/store/chatStore';
import { StructuredBlocksRenderer } from '@/components/chat/blocks/StructuredBlocksRenderer';

// ─── Background Job Persistence ────────────────────────────────────────────
// When the user minimizes/closes the app while the AI is responding, we store
// the jobId+conversationId in localStorage. On return, we poll until done.
const PENDING_JOB_KEY = 'cuca_pending_job';

interface PendingJob {
  jobId: string;
  conversationId: string;
}

function savePendingJob(job: PendingJob) {
  try { localStorage.setItem(PENDING_JOB_KEY, JSON.stringify(job)); } catch {}
}

function loadPendingJob(): PendingJob | null {
  try {
    const raw = localStorage.getItem(PENDING_JOB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearPendingJob() {
  try { localStorage.removeItem(PENDING_JOB_KEY); } catch {}
}
// ───────────────────────────────────────────────────────────────────────────

// Botões de ação para mensagens do assistente
function MessageActions({ onRegenerate, onSelectModel, isRegenerating }: {
  onRegenerate: () => void;
  onSelectModel: () => void;
  isRegenerating: boolean;
}) {
  return (
    <div className="message-actions">
      <button onClick={onRegenerate} className="action-button" disabled={isRegenerating}>
        <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} /> Regenerar
      </button>
      <button onClick={onSelectModel} className="action-button">
        <Settings size={12} /> Modelo
      </button>
    </div>
  );
}

// Botões de ação para mensagens do usuário
function UserMessageActions({ 
  onEdit, 
  onResend, 
  onDelete, 
  onCopy 
}: {
  onEdit: () => void;
  onResend: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  return (
    <div className={clsx(
      "user-message-actions absolute -bottom-8 right-0 flex items-center gap-1 transition-all bg-zinc-900 border border-zinc-800 rounded-lg p-1 shadow-md z-10",
      "opacity-0 group-hover:opacity-100 sm:opacity-0", // Desktop hover
      "max-sm:opacity-100 max-sm:-bottom-9" // Mobile always visible and a bit lower
    )}>
      <button onClick={onEdit} className="p-1.5 text-zinc-400 hover:text-indigo-400 rounded-md hover:bg-zinc-800 transition-colors" title="Editar">
        <Edit2 size={12} />
      </button>
      <button onClick={onCopy} className="p-1.5 text-zinc-400 hover:text-indigo-400 rounded-md hover:bg-zinc-800 transition-colors" title="Copiar">
        <Copy size={12} />
      </button>
      <button onClick={onResend} className="p-1.5 text-zinc-400 hover:text-indigo-400 rounded-md hover:bg-zinc-800 transition-colors" title="Reenviar">
        <Send size={12} />
      </button>
      <div className="w-[1px] h-3 bg-zinc-700 mx-1"></div>
      <button onClick={onDelete} className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-md hover:bg-zinc-800 transition-colors" title="Excluir">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// Cursor de digitação para o streaming
function StreamingCursor() {
  return (
    <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-500 animate-pulse align-middle" />
  );
}

// Indicador do modelo usado
function ModelIndicator({ model }: { model?: string }) {
  if (!model) return null;

  const getModelName = (modelId: string) => {
    const parts = modelId.split('/');
    const modelName = parts[parts.length - 1] || modelId;
    return modelName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-zinc-800/50">
      <Cpu size={10} className="text-zinc-600" />
      <span className="text-[10px] text-zinc-600 font-medium">
        {getModelName(model)}
      </span>
    </div>
  );
}

export function ChatInterface() {
  const { selectedModel, selectedAgent, openExplorer } = useModelsStore();
  const { webSearchEnabled, setWebSearchEnabled } = useUIStore();
  const { currentConversationId, messages: historyMessages, setCurrentConversationId, fetchConversations, fetchMessages, deleteMessage } = useChatStore();

  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<{name: string, id?: string, url?: string, type: 'document' | 'image'} | null>(null);

  // Track the current job for background polling
  const currentJobRef = useRef<PendingJob | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // ─── Polling Logic ─────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
    clearPendingJob();
    currentJobRef.current = null;
  }, []);

  // Renderer customizado para mensagens do usuário para mostrar imagens
  function renderUserMessage(content: string) {
    const parts = content.split(/(!\[.*?\]\(.*?\)|\[Arquivo Anexado: .*?\])/g);
    return parts.map((part, index) => {
      const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (imgMatch) {
         return (
           <div key={index} className="mt-2 mb-1 rounded-xl overflow-hidden border border-white/10 max-w-sm hover:opacity-90 transition-opacity">
             <a href={imgMatch[2]} target="_blank" rel="noopener noreferrer">
               <img src={imgMatch[2]} alt={imgMatch[1]} className="w-full h-auto max-h-60 object-cover" />
             </a>
           </div>
         );
      }
      const docMatch = part.match(/\[Arquivo Anexado: (.*?)\]/);
      if (docMatch) {
         return (
          <div key={index} className="mt-2 mb-1 flex items-center gap-2 bg-white/10 text-white text-xs px-3 py-2 rounded-lg border border-white/20 w-fit">
            <Paperclip size={14} />
            <span>{docMatch[1]}</span>
          </div>
        );
      }
      return <span key={index}>{part}</span>;
    });
  }

  const startPolling = useCallback((job: PendingJob) => {
    currentJobRef.current = job;
    setIsPolling(true);
    savePendingJob(job);

    let attempts = 0;
    const maxAttempts = 60; // 2 min max

    pollingIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        console.warn('[Polling] Max attempts reached, giving up.');
        stopPolling();
        return;
      }

      try {
        const res = await fetch(`/api/chat/status?jobId=${job.jobId}`);
        const data = await res.json();

        if (data.status === 'done') {
          console.log('[Polling] Job done! Reloading messages.');
          stopPolling();
          // Reload the conversation messages from the DB (includes the new assistant reply)
          await fetchMessages(job.conversationId);
        } else if (data.status === 'error') {
          console.error('[Polling] Job failed.');
          stopPolling();
        }
        // else: still pending, keep polling
      } catch (err) {
        console.error('[Polling] Error checking status:', err);
      }
    }, 2000);
  }, [stopPolling, fetchMessages]);
  // ───────────────────────────────────────────────────────────────────────

  const { messages, input, handleInputChange, handleSubmit, append, isLoading, setMessages, reload } = useChat({
    api: '/api/chat',
    body: {
      selectedModel,
      selectedAgent,
      webSearchEnabled,
      conversationId: currentConversationId
    },
    onResponse: (response) => {
      console.log('[ChatInterface] Response received:', response.status);
      const headerId = response.headers.get('x-conversation-id');
      const headerJobId = response.headers.get('x-job-id');

      if (headerId && headerId !== currentConversationId) {
        console.log('[ChatInterface] New conversation ID:', headerId);
        setCurrentConversationId(headerId);
        fetchConversations();
      }

      // Store the job info so we can poll if the app goes to background
      if (headerJobId && (headerId || currentConversationId)) {
        const convId = headerId || currentConversationId!;
        currentJobRef.current = { jobId: headerJobId, conversationId: convId };
        savePendingJob({ jobId: headerJobId, conversationId: convId });
      }

      setRegeneratingId(null);
    },
    onFinish: (message) => {
      console.log('[ChatInterface] Message finished:', message);
      // Stream completed normally — no need for polling fallback
      clearPendingJob();
      currentJobRef.current = null;
      stopPolling();
    },
    onError: (error) => {
      console.error('[ChatInterface] Error:', error);
      clearPendingJob();
      currentJobRef.current = null;
      stopPolling();
    }
  });

  // ─── Visibility / Background Detection ─────────────────────────────────
  useEffect(() => {
    // When app goes to background while streaming, save the job for polling on return
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Going to background
        const job = currentJobRef.current;
        if (job && isLoading) {
          console.log('[Visibility] App hidden during loading. Saving job for polling:', job);
          savePendingJob(job);
        }
      } else {
        // Coming back to foreground
        const pendingJob = loadPendingJob();
        if (pendingJob && !pollingIntervalRef.current) {
          console.log('[Visibility] App visible again. Polling for pending job:', pendingJob);
          startPolling(pendingJob);
        }
      }
    };

    // Check on mount if there's a pending job from a previous session
    const pendingJobOnMount = loadPendingJob();
    if (pendingJobOnMount) {
      console.log('[Mount] Found pending job in localStorage. Starting polling:', pendingJobOnMount);
      startPolling(pendingJobOnMount);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // We intentionally omit `isLoading` from deps to avoid re-registering the listener on every loading change.
    // The closure captures the current state correctly via the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPolling]);
  // ───────────────────────────────────────────────────────────────────────

  // Sync history messages from store to useChat
  useEffect(() => {
    if (historyMessages.length > 0) {
      setMessages(historyMessages.map(m => ({
        id: m.men_id,
        role: m.men_papel as 'user' | 'assistant',
        content: m.men_conteudo,
        men_modelo: m.men_modelo,
        createdAt: new Date(m.men_criado_em)
      })));
    } else if (!currentConversationId) {
      setMessages([]);
    }
  }, [historyMessages, setMessages, currentConversationId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize do textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = Math.min(window.innerHeight * 0.5, 224);
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [input]);

  const handleRegenerate = useCallback(() => {
    if (messages.length >= 2) {
      const lastAssistantIndex = [...messages].reverse().findIndex(m => m.role === 'assistant');
      if (lastAssistantIndex !== -1) {
        const actualIndex = messages.length - 1 - lastAssistantIndex;
        const assistantMessage = messages[actualIndex];
        setRegeneratingId(assistantMessage.id);

        const messagesBeforeAssistant = messages.slice(0, actualIndex);
        const lastUserMessage = [...messagesBeforeAssistant].reverse().find(m => m.role === 'user');

        if (lastUserMessage) {
          const messagesWithoutLast = messages.slice(0, actualIndex);
          setMessages(messagesWithoutLast);

          setTimeout(() => {
            append({
              role: 'user',
              content: lastUserMessage.content
            });
          }, 100);
        }
      }
    }
  }, [messages, setMessages, append]);

  const handleSelectModel = useCallback(() => {
    openExplorer();
  }, [openExplorer]);

  const handleEditUserMessage = useCallback((content: string) => {
    // Put the content in the input and focus
    handleInputChange({ target: { value: content } } as React.ChangeEvent<HTMLTextAreaElement>);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }, [handleInputChange]);

  const handleCopyUserMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content).catch(err => {
      console.error('Failed to copy message:', err);
    });
  }, []);

  const handleDeleteUserMessage = useCallback(async (id: string) => {
    try {
      // First delete from DB via the store
      await deleteMessage(id);
      // Then remove locally from useChat
      setMessages(messages.filter(m => m.id !== id));
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }, [deleteMessage, messages, setMessages]);

  const handleResendUserMessage = useCallback((content: string) => {
    append({
      role: 'user',
      content: content
    });
  }, [append]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    const isImage = file.type.startsWith('image/');
    const apiEndpoint = isImage ? '/api/images/upload' : '/api/documents/upload';

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (isImage) {
          setAttachedFile({ name: file.name, url: data.imageUrl, type: 'image' });
        } else {
          setAttachedFile({ name: file.name, id: data.documentId, type: 'document' });
        }
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}\nDetalhes: ${err.details || ''}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Erro ao enviar arquivo.');
    } finally {
      setIsUploading(true); // Manter true por um momento para o indicador
      setTimeout(() => setIsUploading(false), 500);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFormSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (input.trim() || attachedFile) {
      let finalContent = input.trim();
      
      if (attachedFile?.type === 'image' && attachedFile.url) {
        finalContent = `${finalContent}\n\n![${attachedFile.name}](${attachedFile.url})`.trim();
      } else if (attachedFile?.type === 'document') {
        finalContent = `${finalContent}\n\n[Arquivo Anexado: ${attachedFile.name}]`.trim();
      }

      append(
        { role: 'user', content: finalContent },
        { body: { attachedFile } }
      );
      
      handleInputChange({ target: { value: '' } } as any);
      setTimeout(() => setAttachedFile(null), 100);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || attachedFile) {
        handleFormSubmit();
      }
    }
  };

  const showLoadingIndicator = isLoading || isPolling;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6 relative">
          {(() => {
            const visibleMessages = messages.filter(m => !(m.role === 'assistant' && !m.content));
            
            return (
              <>
          {visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-zinc-500 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg">
                <Sparkles className="text-indigo-400" size={32} />
              </div>
              <p className="text-lg">Como posso ajudar você hoje?</p>
              <p className="text-xs -mt-2 text-zinc-600">Selecione um agente ou comece um novo papo.</p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={clsx(
                  "flex gap-4 w-full relative group message-container animate-in fade-in slide-in-from-bottom-4 duration-500",
                  m.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {m.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                    <Bot size={16} className="text-white" />
                  </div>
                )}

                <div className={clsx(
                  "max-w-[85%] rounded-2xl px-5 py-3 shadow-md transition-all relative",
                  m.role === 'user'
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : "bg-zinc-900/80 border border-zinc-800 text-zinc-200 rounded-tl-sm"
                )}>
                  {m.role === 'assistant' && (
                    <MessageActions
                      onRegenerate={handleRegenerate}
                      onSelectModel={handleSelectModel}
                      isRegenerating={regeneratingId === m.id}
                    />
                  )}
                  {m.role === 'user' && (m.id && !m.id.startsWith('temp-')) && (
                    <UserMessageActions
                      onEdit={() => handleEditUserMessage(m.content)}
                      onCopy={() => handleCopyUserMessage(m.content)}
                      onResend={() => handleResendUserMessage(m.content)}
                      onDelete={() => handleDeleteUserMessage(m.id)}
                    />
                  )}
                  <div className={clsx(
                    "prose prose-sm max-w-none",
                    m.role === 'user'
                      ? "prose-invert text-white prose-p:text-white prose-headings:text-white prose-strong:text-white prose-code:text-white prose-pre:bg-transparent prose-pre:border prose-pre:border-white/10"
                      : ""
                  )}>
                    {m.role === 'assistant' ? (
                      <div className="relative">
                        <StructuredBlocksRenderer content={m.content || ''} />
                        {isLoading && m.id === messages[messages.length - 1]?.id && (
                          <StreamingCursor />
                        )}
                      </div>
                    ) : (
                      <div className="text-zinc-200 whitespace-pre-wrap break-words">
                        {renderUserMessage(m.content)}
                      </div>
                    )}
                  </div>
                  {m.role === 'assistant' && (
                    <ModelIndicator model={(m as any).men_modelo || selectedModel} />
                  )}
                </div>

                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 shadow-md">
                    <User size={16} className="text-zinc-200" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading / Polling indicator */}
          {showLoadingIndicator && visibleMessages[visibleMessages.length - 1]?.role === 'user' && (
            <div className="flex gap-4 w-full justify-start items-center text-zinc-500 animate-in fade-in slide-in-from-bottom-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600/50 flex items-center justify-center shrink-0 animate-pulse">
                {isPolling ? <WifiOff size={14} className="text-white" /> : <Bot size={16} className="text-white" />}
              </div>
              <Loader2 size={16} className="animate-spin text-indigo-400" />
              <span className="text-sm font-medium">
                {isPolling ? 'Cuca terminou de pensar, carregando...' : 'Cuca está pensando...'}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
              </>
            );
          })()}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-zinc-950 border-t border-zinc-900/50">
        <div className="max-w-4xl mx-auto relative">
          
          {/* File Attachment Indicator */}
          {attachedFile && (
            <div className="mb-2 flex items-center gap-2">
              <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-3 py-1.5 rounded-full">
                {attachedFile.type === 'image' && attachedFile.url ? (
                  <div className="w-8 h-8 rounded-md overflow-hidden border border-indigo-500/30">
                    <img src={attachedFile.url} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <Paperclip size={12} className="shrink-0" />
                )}
                <span className="truncate max-w-[200px]">{attachedFile.name} {isUploading ? '...' : ''}</span>
                {!isUploading && (
                  <button 
                    onClick={() => setAttachedFile(null)} 
                    className="hover:text-indigo-300 ml-1 p-0.5 rounded-full hover:bg-indigo-500/20 transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          <form
            onSubmit={handleFormSubmit}
            className="relative flex items-end bg-zinc-900/80 border border-zinc-800 rounded-2xl shadow-xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all overflow-hidden"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.docx,.txt,image/*"
            />
            
            <div className="absolute left-2 bottom-2 flex items-center gap-1">
              <button
                type="button"
                onClick={handleUploadClick}
                disabled={isUploading}
                className="p-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                title="Anexar documento"
              >
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
              </button>
              
              <button
                type="button"
                onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                className={clsx(
                  "p-2.5 rounded-xl transition-colors",
                  webSearchEnabled 
                    ? "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20" 
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                )}
                title={webSearchEnabled ? "Busca Web: Ativada" : "Busca Web: Desativada"}
              >
                <Globe size={18} />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              className="w-full min-h-[56px] bg-transparent text-zinc-100 placeholder-zinc-500 py-4 pl-24 pr-14 resize-none outline-none text-sm transition-all duration-200"
              placeholder="Digite sua mensagem (Shift + Enter para nova linha)..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              style={{ maxHeight: '50vh' }}
            />
            
            <button
              type="submit"
              disabled={showLoadingIndicator || (!input.trim() && !attachedFile)}
              className="absolute right-2 bottom-2 p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
            >
              {showLoadingIndicator ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
          <div className="text-center mt-3">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium">
              Cuca AI • Workspace Inteligente
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
