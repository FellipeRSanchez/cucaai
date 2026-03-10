import { create } from 'zustand';

export interface Conversation {
  con_id: string;
  con_titulo: string;
  con_criado_em: string;
  con_atualizado_em: string;
}

export interface Message {
  men_id: string;
  men_conversa_id: string;
  men_papel: 'user' | 'assistant';
  men_conteudo: string;
  men_criado_em: string;
}

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversationId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  resetChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isLoading: false,
  error: null,

  setConversations: (conversations) => set({ conversations }),
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  setMessages: (messages) => set({ messages }),

  fetchConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) throw new Error('Falha ao buscar conversas');
      const data = await res.json();
      set({ conversations: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchMessages: async (conversationId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/conversations?id=${conversationId}`);
      if (!res.ok) throw new Error('Falha ao buscar mensagens');
      const data = await res.json();
      set({ messages: data, isLoading: false, currentConversationId: conversationId });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  deleteConversation: async (id: string) => {
    try {
      const res = await fetch(`/api/conversations?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao deletar conversa');
      
      const { conversations, currentConversationId } = get();
      set({ 
        conversations: conversations.filter(c => c.con_id !== id),
        currentConversationId: currentConversationId === id ? null : currentConversationId,
        messages: currentConversationId === id ? [] : get().messages
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  resetChat: () => set({ currentConversationId: null, messages: [] })
}));
