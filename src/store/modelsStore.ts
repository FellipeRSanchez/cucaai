import { create } from 'zustand';
import { AgentRole } from '@/lib/agents';

export interface AIModel {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
  context_length: number;
}

interface ModelsState {
  models: AIModel[];
  selectedModel: string;
  selectedAgent: AgentRole;
  isLoading: boolean;
  error: string | null;
  fetchModels: () => Promise<void>;
  setSelectedModel: (modelId: string) => void;
  setSelectedAgent: (agent: AgentRole) => void;
}

export const useModelsStore = create<ModelsState>((set) => ({
  models: [],
  selectedModel: 'openai/chatgpt-4o-latest', // Default fallback
  selectedAgent: 'GERAL',
  isLoading: false,
  error: null,
  fetchModels: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/models');
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      set({ models: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  setSelectedModel: (modelId) => set({ selectedModel: modelId }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
}));
