'use client';

import { useChat } from '@ai-sdk/react';
import { useModelsStore } from '@/store/modelsStore';
import { Send, Loader2, Sparkles, User, Bot, RefreshCw, Settings, Cpu, Paperclip, X } from 'lucide-react';
import { useEffect, useRef, useCallback, useState } from 'react';
import clsx from 'clsx';

import { useUIStore } from '@/store/uiStore';
import { useChatStore } from '@/store/chatStore';
import { StructuredBlocksRenderer } from '@/components/chat/blocks/StructuredBlocksRenderer';

// Botões de ação para mensagens
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

// Indicador do modelo usado
function ModelIndicator({ model }: { model?: string }) {
  if (!model) return null;

  // Extrair nome amigável do modelo
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
  const { webSearchEnabled } = useUIStore();
  const { currentConversationId, messages: historyMessages, setCurrentConversationId, fetchConversations } = useChatStore();

  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<{name: string, id: string} | null>(null);

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
      if (headerId && headerId !== currentConversationId) {
        console.log('[ChatInterface] New conversation ID:', headerId);
        setCurrentConversationId(headerId);
        fetchConversations();
      }
      setRegeneratingId(null);
    },
    onFinish: (message) => {
      console.log('[ChatInterface] Message finished:', message);
    },
    onError: (error) => {
      console.error('[ChatInterface] Error:', error);
    }
  });

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
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Calculate new height (max 50vh or 4x original)
      const maxHeight = Math.min(window.innerHeight * 0.5, 224); // 50vh ou ~4x56px
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [input]);

  const handleRegenerate = useCallback(() => {
    if (messages.length >= 2) {
      // Encontrar a última mensagem do assistente
      const lastAssistantIndex = [...messages].reverse().findIndex(m => m.role === 'assistant');
      if (lastAssistantIndex !== -1) {
        const actualIndex = messages.length - 1 - lastAssistantIndex;
        const assistantMessage = messages[actualIndex];
        setRegeneratingId(assistantMessage.id);

        // Encontrar a última mensagem do usuário antes da resposta do assistente
        const messagesBeforeAssistant = messages.slice(0, actualIndex);
        const lastUserMessage = [...messagesBeforeAssistant].reverse().find(m => m.role === 'user');

        if (lastUserMessage) {
          // Remover a última mensagem do assistente
          const messagesWithoutLast = messages.slice(0, actualIndex);
          setMessages(messagesWithoutLast);

          // Reenviar a última mensagem do usuário usando append
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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAttachedFile({ name: file.name, id: data.documentId });
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}\nDetalhes: ${err.details || ''}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Erro ao enviar documento.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFormSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (input.trim() || attachedFile) {
      handleSubmit(e as any);
      setTimeout(() => setAttachedFile(null), 100);
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

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6 relative">
          {messages.length === 0 ? (
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
                  "flex gap-4 w-full relative group message-container",
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
                  <div className={clsx(
                    "prose prose-sm max-w-none",
                    m.role === 'user'
                      ? "prose-invert text-white prose-p:text-white prose-headings:text-white prose-strong:text-white prose-code:text-white prose-pre:bg-transparent prose-pre:border prose-pre:border-white/10"
                      : ""
                  )}>
                    {m.role === 'assistant' ? (
                      <StructuredBlocksRenderer content={m.content || ''} />
                    ) : (
                      <div className="text-zinc-200 whitespace-pre-wrap break-words">
                        {m.content}
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
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-4 w-full justify-start items-center text-zinc-500 animate-in fade-in slide-in-from-bottom-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600/50 flex items-center justify-center shrink-0 animate-pulse">
                <Bot size={16} className="text-white" />
              </div>
              <Loader2 size={16} className="animate-spin text-indigo-400" />
              <span className="text-sm font-medium">Cuca está pensando...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-zinc-950 border-t border-zinc-900/50">
        <div className="max-w-4xl mx-auto relative">
          
          {/* File Attachment Indicator */}
          {attachedFile && (
            <div className="mb-2 flex items-center gap-2">
              <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-3 py-1.5 rounded-full">
                <Paperclip size={12} className="shrink-0" />
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
              accept=".pdf,.docx,.txt"
            />
            
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={isUploading}
              className="absolute left-2 bottom-2 p-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              title="Anexar documento"
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>

            <textarea
              ref={textareaRef}
              className="w-full min-h-[56px] bg-transparent text-zinc-100 placeholder-zinc-500 py-4 pl-14 pr-14 resize-none outline-none text-sm transition-all duration-200"
              placeholder="Digite sua mensagem (Shift + Enter para nova linha)..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              style={{ maxHeight: '50vh' }}
            />
            
            <button
              type="submit"
              disabled={isLoading || (!input.trim() && !attachedFile)}
              className="absolute right-2 bottom-2 p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
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
