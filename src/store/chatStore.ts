import { create } from 'zustand';
import { useModelsStore } from './modelsStore';
import { AgentProfile } from '@/lib/agents';

export interface Project {
  pro_id: string;
  pro_usuario_id: string;
  pro_nome: string;
  pro_descricao: string | null;
  pro_system_prompt: string | null;
  pro_emoji: string;
  pro_cor: string;
  pro_criado_em: string;
  pro_atualizado_em: string;
}

export interface Conversation {
  con_id: string;
  con_titulo: string;
  con_projeto_id?: string | null;
  con_criado_em: string;
  con_atualizado_em: string;
}

export interface Message {
  men_id: string;
  men_conversa_id: string;
  men_papel: 'user' | 'assistant';
  men_conteudo: string;
  men_modelo?: string;
  men_criado_em: string;
}

// Agent interface for custom agents from database
export interface CustomAgent {
  id: string;
  usuario_id: string;
  nome: string;
  descricao: string | null;
  emoji: string;
  system_prompt: string;
  ferramentas: string[];
  is_default: boolean;
  criado_em: string;
  atualizado_em: string;
}

// Combined agent type that works with both default and custom agents
export type Agent = AgentProfile | CustomAgent;

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  currentProjectId: string | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  
  // Project state
  projects: Project[];
  projectsLoading: boolean;
  
  // Agent state
  customAgents: CustomAgent[];
  agentsLoading: boolean;
  agentsError: string | null;

  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversationId: (id: string | null) => void;
  setCurrentProjectId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, newTitle: string) => Promise<void>;
  moveConversationToProject: (conversationId: string, projectId: string | null) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  resetChat: () => void;

  // Project actions
  fetchProjects: () => Promise<void>;
  createProject: (data: { nome: string; descricao?: string; system_prompt?: string; emoji?: string; cor?: string }) => Promise<Project | null>;
  updateProject: (id: string, data: { nome?: string; descricao?: string; system_prompt?: string; emoji?: string; cor?: string }) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  
  // Agent actions
  setCustomAgents: (agents: CustomAgent[]) => void;
  setAgentsLoading: (loading: boolean) => void;
  setAgentsError: (error: string | null) => void;
  loadCustomAgents: () => Promise<void>;
  saveAgent: (agent: Omit<CustomAgent, 'id' | 'usuario_id' | 'criado_em' | 'atualizado_em'> & Partial<Pick<CustomAgent, 'id'>>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  currentProjectId: null,
  messages: [],
  isLoading: false,
  error: null,
  
  // Project state
  projects: [],
  projectsLoading: false,
  
  // Agent state
  customAgents: [],
  agentsLoading: false,
  agentsError: null,

  setConversations: (conversations) => set({ conversations }),
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  setCurrentProjectId: (id) => set({ currentProjectId: id }),
  setMessages: (messages) => set({ messages }),
  
  // Agent actions
  setCustomAgents: (agents) => set({ customAgents: agents }),
  setAgentsLoading: (loading) => set({ agentsLoading: loading }),
  setAgentsError: (error) => set({ agentsError: error }),

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

      // Restaurar o modelo usado anteriormente nesta conversa
      const lastAssistantMsg = [...data].reverse().find((m: any) => m.men_papel === 'assistant' && m.men_modelo);
      if (lastAssistantMsg && lastAssistantMsg.men_modelo) {
        useModelsStore.getState().setSelectedModel(lastAssistantMsg.men_modelo);
      }
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

  updateConversationTitle: async (id: string, newTitle: string) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: newTitle }),
      });
      if (!res.ok) throw new Error('Falha ao renomear conversa');

      const { conversations } = get();
      set({
        conversations: conversations.map(c =>
          c.con_id === id ? { ...c, con_titulo: newTitle } : c
        )
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  moveConversationToProject: async (conversationId: string, projectId: string | null) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conversationId, projeto_id: projectId || '' }),
      });
      if (!res.ok) throw new Error('Falha ao mover conversa');

      const { conversations } = get();
      set({
        conversations: conversations.map(c =>
          c.con_id === conversationId ? { ...c, con_projeto_id: projectId } : c
        )
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  // Project actions
  fetchProjects: async () => {
    set({ projectsLoading: true });
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Falha ao buscar projetos');
      const data = await res.json();
      set({ projects: data, projectsLoading: false });
    } catch (err: any) {
      console.error(err);
      set({ projectsLoading: false });
    }
  },

  createProject: async (data) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Falha ao criar projeto');
      const newProject = await res.json();
      set(state => ({ projects: [newProject, ...state.projects] }));
      return newProject;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  updateProject: async (id, data) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Falha ao atualizar projeto');
      const updated = await res.json();
      set(state => ({
        projects: state.projects.map(p => p.pro_id === id ? updated : p)
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteProject: async (id) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao deletar projeto');
      set(state => ({
        projects: state.projects.filter(p => p.pro_id !== id),
        conversations: state.conversations.map(c =>
          c.con_projeto_id === id ? { ...c, con_projeto_id: null } : c
        )
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteMessage: async (id: string) => {
    try {
      const res = await fetch(`/api/messages?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao deletar mensagem');

      const { messages } = get();
      set({
        messages: messages.filter(m => m.men_id !== id)
      });
    } catch (err: any) {
      console.error(err);
      set({ error: err.message });
    }
  },

  resetChat: () => set({ currentConversationId: null, messages: [] }),
  
  // Agent actions
  loadCustomAgents: async () => {
    set({ agentsLoading: true, agentsError: null });
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error('Falha ao buscar agentes');
      const data = await res.json();
      set({ customAgents: data, agentsLoading: false });
    } catch (err: any) {
      set({ agentsError: err.message, agentsLoading: false });
    }
  },

  saveAgent: async (agentData) => {
    try {
      // If agent has an ID, it's an update; otherwise, it's a create
      if (agentData.id) {
        const res = await fetch('/api/agents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentData),
        });
        if (!res.ok) throw new Error('Falha ao atualizar agente');
        
        const updatedAgent = await res.json();
        // Update the agent in the store
        set(state => ({
          customAgents: state.customAgents.map(agent =>
            agent.id === agentData.id ? updatedAgent : agent
          )
        }));
      } else {
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentData),
        });
        if (!res.ok) throw new Error('Falha ao criar agente');
        
        const newAgent = await res.json();
        // Add the new agent to the store
        set(state => ({
          customAgents: [...state.customAgents, newAgent]
        }));
      }
    } catch (err: any) {
      throw err; // Re-throw to be handled by calling function
    }
  },

  deleteAgent: async (id: string) => {
    try {
      const res = await fetch(`/api/agents?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao deletar agente');
      
      // Remove the agent from the store
      set(state => ({
        customAgents: state.customAgents.filter(agent => agent.id !== id)
      }));
    } catch (err: any) {
      throw err; // Re-throw to be handled by calling function
    }
  }
}));
