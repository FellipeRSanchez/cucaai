import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────

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

// ─── Preset Definitions ───────────────────────────────────────────────────

const PREFERRED_MODELS: Record<NonNullable<ModelPreset>, string[]> = {
  best_overall: [
    'anthropic/claude-sonnet-4',
    'anthropic/claude-3.7-sonnet',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4.1',
    'openai/chatgpt-4o-latest',
    'openai/gpt-4o-mini',
    'google/gemini-2.5-pro',
    'google/gemini-2.0-flash-001',
    'google/gemini-2.5-flash',
    'meta-llama/llama-4-maverick',
  ],
  best_free: [],
  best_code: [
    'anthropic/claude-sonnet-4',
    'deepseek/deepseek-r1',
    'deepseek/deepseek-chat',
    'openai/gpt-4.1',
    'google/gemini-2.5-pro',
  ],
  best_reasoning: [
    'openai/o3',
    'openai/o3-mini',
    'openai/o1',
    'anthropic/claude-sonnet-4',
    'deepseek/deepseek-r1',
    'google/gemini-2.5-pro',
    'google/gemini-2.0-flash-thinking-exp-01-21',
  ],
  best_image: [
    'anthropic/claude-sonnet-4',
    'openai/gpt-4.1',
    'google/gemini-2.5-flash',
    'meta-llama/llama-4-maverick',
  ],
};

const PRESET_TAGS: Record<NonNullable<ModelPreset>, string[]> = {
  best_overall: ['chat'],
  best_free: ['free'],
  best_code: ['code'],
  best_reasoning: ['reasoning'],
  best_image: ['vision'],
};

export function applyPreset(preset: NonNullable<ModelPreset>, models: AIModel[]): AIModel[] {
  if (preset === 'best_free') {
    return models
      .filter(m => m.is_free)
      .sort((a, b) => b.context_length - a.context_length);
  }

  const preferred = PREFERRED_MODELS[preset];
  const sorted: AIModel[] = [];
  const remaining: AIModel[] = [];
  const sortedIds = new Set<string>();

  for (const id of preferred) {
    const found = models.find(m => m.id === id);
    if (found) {
      sorted.push(found);
      sortedIds.add(found.id);
    }
  }

  const fallbackTags = PRESET_TAGS[preset] ?? [];
  for (const m of models) {
    if (sortedIds.has(m.id)) continue;
    if (fallbackTags.length > 0 && fallbackTags.some(t => m.tags.includes(t))) {
      remaining.push(m);
    } else if (preset === 'best_image' && (m.modality === 'multimodal' || m.tags.includes('vision'))) {
      remaining.push(m);
    }
  }

  remaining.sort((a, b) => b.context_length - a.context_length);

  return sorted.concat(remaining);
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

const MAX_RECENT_MODELS = 5;

// ─── Store ────────────────────────────────────────────────────────────────

interface ModelsState {
  models: AIModel[];
  selectedModel: string;
  selectedAgent: string; // Can be AgentRole (default) or custom agent UUID
  isLoading: boolean;
  error: string | null;
  // Explorer state
  isExplorerOpen: boolean;
  activePreset: ModelPreset;
  filters: ModelFilters;
  // Favorites
  favoriteModels: string[];
  // Recent
  recentModels: string[];
  // View mode
  viewMode: 'grid' | 'list';
  // Actions
  fetchModels: () => Promise<void>;
  refreshModels: () => Promise<void>;
  setSelectedModel: (modelId: string) => void;
  setSelectedAgent: (agent: string) => void; // Accept both default and custom agents
  openExplorer: () => void;
  closeExplorer: () => void;
  setPreset: (preset: ModelPreset) => void;
  setFilter: (key: keyof ModelFilters, value: ModelFilters[keyof ModelFilters]) => void;
  resetFilters: () => void;
  // Favorites actions
  toggleFavorite: (modelId: string) => void;
  isFavorite: (modelId: string) => boolean;
  // Recent actions
  addRecentModel: (modelId: string) => void;
  getRecentModels: () => AIModel[];
  // View mode
  setViewMode: (mode: 'grid' | 'list') => void;
  // Computed
  getFilteredModels: () => AIModel[];
  getSelectedModelData: () => AIModel | undefined;
  getAllProviders: () => string[];
}

// Função para encontrar o melhor modelo gratuito
function getBestFreeModel(models: AIModel[]): string {
  const freeModels = models.filter(m => m.is_free);
  if (freeModels.length === 0) {
    const fallback = models[0]?.id ?? 'openai/chatgpt-4o-latest';
    console.warn('[modelsStore] Nenhum modelo gratuito encontrado. Usando fallback:', fallback);
    return fallback;
  }

  // Ordenar por context_length (maior primeiro) e depois por nome
  const sorted = freeModels.sort((a, b) => {
    if (b.context_length !== a.context_length) {
      return b.context_length - a.context_length;
    }
    return a.name.localeCompare(b.name);
  });

  return sorted[0].id;
}

// Função para obter favoritos do localStorage (apenas no cliente)
function getInitialFavoriteModels(): string[] {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('cucaai_favorite_models');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('[modelsStore] Falha ao carregar favoritos do localStorage, resetando estado.', error);
      return [];
    }
  }
  return [];
}

function getInitialRecentModels(): string[] {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('cucaai_recent_models');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
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
  favoriteModels: getInitialFavoriteModels(),
  recentModels: getInitialRecentModels(),
  viewMode: 'grid',

  fetchModels: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/models');
      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      const models = Array.isArray(data) ? data : [];

      const currentSelected = get().selectedModel;
      const stillExists = models.find(m => m.id === currentSelected);
      const nextSelectedModel = stillExists ? currentSelected : getBestFreeModel(models);

      if (!stillExists) {
        console.debug('[modelsStore] Modelo selecionado anterior não existe mais. Selecionando novo fallback:', {
          previous: currentSelected,
          next: nextSelectedModel,
        });
      }

      set({
        models,
        selectedModel: nextSelectedModel,
        isLoading: false
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch models';
      set({ error: message, isLoading: false });
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to refresh models';
      set({ error: message, isLoading: false });
    }
  },

  setSelectedModel: (modelId) => {
    set({ selectedModel: modelId });
    get().addRecentModel(modelId);
  },
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  openExplorer: () => set({ isExplorerOpen: true }),
  closeExplorer: () => set({ isExplorerOpen: false }),
  setPreset: (preset) => set({ activePreset: preset, filters: DEFAULT_FILTERS }),
  setFilter: (key, value) => set(s => ({
    activePreset: null,
    filters: { ...s.filters, [key]: value }
  })),
  resetFilters: () => set({ activePreset: null, filters: DEFAULT_FILTERS }),

  toggleFavorite: (modelId) => {
    set((state) => {
      const isFav = state.favoriteModels.includes(modelId);
      let newFavorites;
      if (isFav) {
        newFavorites = state.favoriteModels.filter(id => id !== modelId);
      } else {
        newFavorites = [...state.favoriteModels, modelId];
      }
      // Persistir no localStorage (apenas no cliente)
      if (typeof window !== 'undefined') {
        localStorage.setItem('cucaai_favorite_models', JSON.stringify(newFavorites));
      }
      return { favoriteModels: newFavorites };
    });
  },

  isFavorite: (modelId) => {
    return get().favoriteModels.includes(modelId);
  },

  addRecentModel: (modelId) => {
    set((state) => {
      const filtered = state.recentModels.filter(id => id !== modelId);
      const updated = [modelId, ...filtered].slice(0, MAX_RECENT_MODELS);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cucaai_recent_models', JSON.stringify(updated));
      }
      return { recentModels: updated };
    });
  },

  getRecentModels: () => {
    const { models, recentModels } = get();
    return recentModels
      .map(id => models.find(m => m.id === id))
      .filter((m): m is AIModel => m !== undefined);
  },

  setViewMode: (mode) => set({ viewMode: mode }),

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
    const all = [...new Set(models.map(m => m.provider))];
    const POPULAR_ORDER = [
      'anthropic', 'openai', 'google', 'deepseek', 'qwen',
      'meta-llama', 'mistralai', 'x-ai',
    ];
    const popular = POPULAR_ORDER.filter(p => all.includes(p));
    const rest = all.filter(p => !POPULAR_ORDER.includes(p)).sort();
    return [...popular, ...rest];
  },
}));
