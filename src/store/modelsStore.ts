import { create } from 'zustand';
import { AgentRole } from '@/lib/agents';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIModel {
  id: string;
  name: string;
  description?: string;
  provider: string;
  context_length: number;
  pricing_prompt: number;       // $ per 1M tokens
  pricing_completion: number;   // $ per 1M tokens
  modality: 'text' | 'image' | 'multimodal';
  capabilities: {
    vision: boolean;
    tools: boolean;
    json_mode: boolean;
  };
  tags: string[];
  is_free: boolean;
}

export type ModelPreset =
  | 'best_overall'
  | 'best_free'
  | 'best_code'
  | 'best_reasoning'
  | 'best_image'
  | null;

export interface ModelFilters {
  search: string;
  providers: string[];       // empty = all
  modalities: string[];      // 'text'|'image'|'multimodal'
  tags: string[];            // 'code'|'reasoning'|'chat'|'vision'
  maxPricePrompt: number | null;   // null = any
  minContext: number | null; // null = any
  freeOnly: boolean;
}

const DEFAULT_FILTERS: ModelFilters = {
  search: '',
  providers: [],
  modalities: [],
  tags: [],
  maxPricePrompt: null,
  minContext: null,
  freeOnly: false,
};

// ─── Preset Definitions ───────────────────────────────────────────────────────

const PREFERRED_MODELS: Record<NonNullable<ModelPreset>, string[]> = {
  best_overall: [
    'anthropic/claude-opus-4',
    'anthropic/claude-3.7-sonnet',
    'anthropic/claude-3.5-sonnet',
    'openai/chatgpt-4o-latest',
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-4-maverick',
  ],
  best_free: [],    // computed: any free model, sorted by context
  best_code: [
    'deepseek/deepseek-coder-v2-instruct',
    'anthropic/claude-3.7-sonnet',
    'mistralai/codestral-latest',
    'deepseek/deepseek-v3',
  ],
  best_reasoning: [
    'deepseek/deepseek-r1',
    'openai/o3-mini',
    'openai/o1',
    'anthropic/claude-3.7-sonnet',
    'google/gemini-2.0-flash-thinking-exp',
  ],
  best_image: [
    'anthropic/claude-3.7-sonnet',
    'openai/gpt-4o',
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.2-90b-vision-instruct',
  ],
};

function applyPreset(preset: NonNullable<ModelPreset>, models: AIModel[]): AIModel[] {
  if (preset === 'best_free') {
    return models
      .filter(m => m.is_free)
      .sort((a, b) => b.context_length - a.context_length);
  }

  const preferred = PREFERRED_MODELS[preset];
  const sorted: AIModel[] = [];

  // Add preferred models first (in priority order)
  for (const id of preferred) {
    const found = models.find(m => m.id === id);
    if (found) sorted.push(found);
  }

  // Then add remaining that match the theme
  for (const m of models) {
    if (!sorted.find(s => s.id === m.id)) {
      if (preset === 'best_code' && m.tags.includes('code')) sorted.push(m);
      else if (preset === 'best_reasoning' && m.tags.includes('reasoning')) sorted.push(m);
      else if (preset === 'best_image' && (m.modality === 'multimodal' || m.tags.includes('vision'))) sorted.push(m);
    }
  }

  return sorted;
}

function applyFilters(models: AIModel[], filters: ModelFilters): AIModel[] {
  return models.filter(m => {
    if (filters.freeOnly && !m.is_free) return false;
    if (filters.modalities.length > 0 && !filters.modalities.includes(m.modality)) return false;
    if (filters.providers.length > 0 && !filters.providers.includes(m.provider)) return false;
    if (filters.tags.length > 0 && !filters.tags.some(t => m.tags.includes(t))) return false;
    if (filters.maxPricePrompt !== null && m.pricing_prompt > filters.maxPricePrompt) return false;
    if (filters.minContext !== null && m.context_length < filters.minContext) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.id.toLowerCase().includes(q) && !m.provider.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ModelsState {
  models: AIModel[];
  selectedModel: string;
  selectedAgent: AgentRole;
  isLoading: boolean;
  error: string | null;
  // Explorer state
  isExplorerOpen: boolean;
  activePreset: ModelPreset;
  filters: ModelFilters;
  // Actions
  fetchModels: () => Promise<void>;
  refreshModels: () => Promise<void>;
  setSelectedModel: (modelId: string) => void;
  setSelectedAgent: (agent: AgentRole) => void;
  openExplorer: () => void;
  closeExplorer: () => void;
  setPreset: (preset: ModelPreset) => void;
  setFilter: (key: keyof ModelFilters, value: ModelFilters[keyof ModelFilters]) => void;
  resetFilters: () => void;
  // Computed
  getFilteredModels: () => AIModel[];
  getSelectedModelData: () => AIModel | undefined;
  getAllProviders: () => string[];
}

// Função para encontrar o melhor modelo gratuito
function getBestFreeModel(models: AIModel[]): string {
  const freeModels = models.filter(m => m.is_free);
  if (freeModels.length === 0) return 'google/gemma-2-9b-it'; // fallback

  // Ordenar por context_length (maior primeiro) e depois por nome
  const sorted = freeModels.sort((a, b) => {
    if (b.context_length !== a.context_length) {
      return b.context_length - a.context_length;
    }
    return a.name.localeCompare(b.name);
  });

  return sorted[0].id;
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  selectedModel: 'google/gemma-2-9b-it', // Modelo free padrão inicial
  selectedAgent: 'GERAL',
  isLoading: false,
  error: null,
  isExplorerOpen: false,
  activePreset: null,
  filters: DEFAULT_FILTERS,

  fetchModels: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/models');
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      const models = Array.isArray(data) ? data : [];

      // Selecionar automaticamente o melhor modelo gratuito
      const bestFreeModel = getBestFreeModel(models);

      set({
        models,
        selectedModel: bestFreeModel,
        isLoading: false
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  refreshModels: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/models?refresh=1');
      if (!response.ok) throw new Error('Failed to refresh models');
      const data = await response.json();
      const models = Array.isArray(data) ? data : [];

      const currentSelected = get().selectedModel;
      const stillExists = models.find(m => m.id === currentSelected);
      const newSelectedModel = stillExists ? currentSelected : getBestFreeModel(models);

      set({
        models,
        selectedModel: newSelectedModel,
        isLoading: false
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setSelectedModel: (modelId) => set({ selectedModel: modelId }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  openExplorer: () => set({ isExplorerOpen: true }),
  closeExplorer: () => set({ isExplorerOpen: false }),
  setPreset: (preset) => set({ activePreset: preset, filters: DEFAULT_FILTERS }),
  setFilter: (key, value) => set(s => ({
    activePreset: null,
    filters: { ...s.filters, [key]: value }
  })),
  resetFilters: () => set({ activePreset: null, filters: DEFAULT_FILTERS }),

  getFilteredModels: () => {
    const { models, activePreset, filters } = get();
    if (activePreset) return applyPreset(activePreset, models);
    return applyFilters(models, filters);
  },

  getSelectedModelData: () => {
    const { models, selectedModel } = get();
    return models.find(m => m.id === selectedModel);
  },

  getAllProviders: () => {
    const { models } = get();
    return [...new Set(models.map(m => m.provider))].sort();
  },
}));
