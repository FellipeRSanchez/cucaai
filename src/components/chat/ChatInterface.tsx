'use client';

import { useChat } from '@ai-sdk/react';
import { useModelsStore } from '@/store/modelsStore';
import { Send, Loader2, Sparkles, User, Bot } from 'lucide-react';
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';

import { useUIStore } from '@/store/uiStore';
import { useChatStore } from '@/store/chatStore';

export function ChatInterface() {
  const { selectedModel, selectedAgent } = useModelsStore();
  const { webSearchEnabled } = useUIStore();
  const { currentConversationId, messages: historyMessages, setCurrentConversationId, fetchConversations } = useChatStore();
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: '/api/chat',
    body: {
      selectedModel,
      selectedAgent,
      webSearchEnabled,
      conversationId: currentConversationId
    },
    onResponse: (response) => {
      // Capture the conversation ID from the header if it's new
      const headerId = response.headers.get('x-conversation-id');
      if (headerId && headerId !== currentConversationId) {
        setCurrentConversationId(headerId);
        // Refresh sidebar list
        fetchConversations();
      }
    }
  });

  // Sync history messages from store to useChat
  useEffect(() => {
    if (historyMessages.length > 0) {
      setMessages(historyMessages.map(m => ({
        id: m.men_id,
        role: m.men_papel as 'user' | 'assistant',
        content: m.men_conteudo,
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

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">
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
                   "flex gap-4 w-full",
                   m.role === 'user' ? "justify-end" : "justify-start"
                 )}
               >
                 {m.role !== 'user' && (
                   <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                     <Bot size={16} className="text-white" />
                   </div>
                 )}
                 
                 <div className={clsx(
                   "max-w-[85%] rounded-2xl px-5 py-3 shadow-md transition-all",
                   m.role === 'user' 
                     ? "bg-indigo-600 text-white rounded-tr-sm" 
                     : "bg-zinc-900/80 border border-zinc-800 text-zinc-200 rounded-tl-sm"
                 )}>
                   <div className={clsx(
                     "prose prose-sm max-w-none",
                     m.role === 'user' ? "prose-invert text-white prose-p:text-white" : "prose-invert"
                   )}>
                     <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                     </ReactMarkdown>
                   </div>
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
          <form 
            onSubmit={handleSubmit}
            className="relative flex items-end bg-zinc-900/80 border border-zinc-800 rounded-2xl shadow-xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all overflow-hidden"
          >
            <textarea
              className="w-full max-h-48 min-h-[56px] bg-transparent text-zinc-100 placeholder-zinc-500 p-4 pr-14 resize-none outline-none text-sm"
              placeholder="Digite sua mensagem (Shift + Enter para nova linha)..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) {
                    handleSubmit(e as any);
                  }
                }
              }}
              rows={1}
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
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
