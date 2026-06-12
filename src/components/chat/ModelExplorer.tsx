'use client';

import { useModelsStore, AIModel } from '@/store/modelsStore';
import { X, Search, Cpu, Zap, Gift, Check, Star, LayoutGrid, List, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  if (price === 0) return 'Grátis';
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

function formatContext(ctx: number): string {
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(0)}M`;
  if (ctx >= 1_000) return `${Math.round(ctx / 1000)}k`;
  return String(ctx);
}

function friendlyProvider(p: string): string {
  const map: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    mistralai: 'Mistral',
    'meta-llama': 'Meta',
    deepseek: 'DeepSeek',
    qwen: 'Qwen',
    'x-ai': 'Grok',
    cohere: 'Cohere',
    perplexity: 'Perplexity',
    microsoft: 'Microsoft',
  };
  return map[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModelCard({ model, isSelected, onSelect, compact }: {
  model: AIModel;
  isSelected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const isFavorite = useModelsStore(state => state.isFavorite);
  const toggleFavorite = useModelsStore(state => state.toggleFavorite);

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
        className={clsx(
          'group flex items-center gap-3 px-3 py-2 rounded-lg border transition-all duration-150 cursor-pointer',
          isSelected
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-transparent hover:bg-zinc-800/60 hover:border-zinc-700'
        )}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isSelected && <Check size={13} className="text-indigo-400 shrink-0" />}
          <p className="text-sm text-zinc-200 truncate">{model.name}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-400 border border-zinc-600/30 shrink-0">
            {friendlyProvider(model.provider)}
          </span>
          {model.is_free && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 shrink-0">free</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 shrink-0">
          <span className="flex items-center gap-1"><Cpu size={10} />{formatContext(model.context_length)}</span>
          <span className="flex items-center gap-1"><Zap size={10} />{formatPrice(model.pricing_prompt)}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(model.id); }}
          className="p-1 rounded hover:bg-zinc-700/50 transition-colors shrink-0"
          title={isFavorite(model.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Star size={14} className={isFavorite(model.id) ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-600'} />
        </button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      className={clsx(
        'group relative text-left w-full rounded-xl border p-4 transition-all duration-200',
        'bg-zinc-900/60 hover:bg-zinc-900 focus:outline-none',
        isSelected
          ? 'border-indigo-500 ring-1 ring-indigo-500/30 shadow-lg shadow-indigo-500/10'
          : 'border-zinc-800 hover:border-zinc-600'
      )}
    >
      {isSelected && (
        <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
          <Check size={11} className="text-white" />
        </div>
      )}

      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate leading-tight">{model.name}</p>
          <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-zinc-700/40 text-zinc-300 border-zinc-600/30">
            {friendlyProvider(model.provider)}
          </span>
        </div>
        <div className="flex-shrink-0">
          <div
            onClick={(e) => { e.stopPropagation(); toggleFavorite(model.id); }}
            className="p-1 rounded hover:bg-zinc-800 transition-colors"
            title={isFavorite(model.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            {isFavorite(model.id) ? (
              <Star size={18} className="text-yellow-400 fill-yellow-400" />
            ) : (
              <Star size={18} className="text-zinc-400" />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2.5 text-[11px] text-zinc-400">
        <span className="flex items-center gap-1" title="Contexto máximo">
          <Cpu size={11} />
          {formatContext(model.context_length)}
        </span>
        <span className="flex items-center gap-1" title="Preço prompt / conclusão">
          <Zap size={11} />
          <span className={model.is_free ? 'text-emerald-400 font-medium' : ''}>
            {formatPrice(model.pricing_prompt)}
          </span>
          {!model.is_free && (
            <span className="text-zinc-600">
              / {formatPrice(model.pricing_completion)}
            </span>
          )}
        </span>
      </div>

      {model.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {model.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className={clsx(
                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                tag === 'free' ? 'bg-emerald-500/20 text-emerald-300' :
                tag === 'code' ? 'bg-sky-500/20 text-sky-300' :
                tag === 'reasoning' ? 'bg-purple-500/20 text-purple-300' :
                'bg-zinc-700/40 text-zinc-400'
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Provider Group Section ───────────────────────────────────────────────────

function ProviderGroup({ provider, models, selectedModel, onSelect, compact, defaultOpen }: {
  provider: string;
  models: AIModel[];
  selectedModel: string;
  onSelect: (id: string) => void;
  compact: boolean;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);
  const hasSelected = models.some(m => m.id === selectedModel);

  return (
    <section className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left py-2 px-1 group"
      >
        {isOpen ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
        <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          {friendlyProvider(provider)}
          <span className="text-[10px] font-normal text-zinc-600">({models.length})</span>
          {hasSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
        </h3>
      </button>
      {isOpen && (
        compact ? (
          <div className="flex flex-col gap-0.5 ml-5">
            {models.map(model => (
              <ModelCard
                key={model.id}
                model={model}
                isSelected={model.id === selectedModel}
                onSelect={() => onSelect(model.id)}
                compact
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 ml-5">
            {models.map(model => (
              <ModelCard
                key={model.id}
                model={model}
                isSelected={model.id === selectedModel}
                onSelect={() => onSelect(model.id)}
              />
            ))}
          </div>
        )
      )}
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ModelExplorer() {
  const isExplorerOpen = useModelsStore(state => state.isExplorerOpen);
  const closeExplorer = useModelsStore(state => state.closeExplorer);
  const selectedModel = useModelsStore(state => state.selectedModel);
  const setSelectedModel = useModelsStore(state => state.setSelectedModel);
  const isLoading = useModelsStore(state => state.isLoading);
  const fetchModels = useModelsStore(state => state.fetchModels);
  const refreshModels = useModelsStore(state => state.refreshModels);
  const favoriteModels = useModelsStore(state => state.favoriteModels);
  const models = useModelsStore(state => state.models);
  const filters = useModelsStore(state => state.filters);
  const setFilter = useModelsStore(state => state.setFilter);
  const getRecentModels = useModelsStore(state => state.getRecentModels);
  const getAllProviders = useModelsStore(state => state.getAllProviders);
  const viewMode = useModelsStore(state => state.viewMode);
  const setViewMode = useModelsStore(state => state.setViewMode);
  const getSelectedModelData = useModelsStore(state => state.getSelectedModelData);

  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [activeProviderFilter, setActiveProviderFilter] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<'flat' | 'provider'>('flat');
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const gridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isExplorerOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchQuery('');
      setShowFavoritesOnly(false);
      setActiveProviderFilter(null);
      setGroupMode('flat');
      setFocusedIndex(-1);
      setFilter('freeOnly', false);
    }
  }, [isExplorerOpen, setFilter]);

  useEffect(() => {
    if (useModelsStore.getState().models.length === 0) {
      void fetchModels();
    }
  }, [fetchModels]);

  useEffect(() => {
    if (!isExplorerOpen) return;

    const current = useModelsStore.getState().models;
    if (current.length === 0) {
      void fetchModels();
    } else {
      void refreshModels();
    }
  }, [isExplorerOpen, fetchModels, refreshModels]);

  useEffect(() => {
    if (isExplorerOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isExplorerOpen]);

  const filteredModels = useMemo(() => {
    const modelsFromStore = models.filter(m => {
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
    const base = modelsFromStore.filter(model => {
      if (showFavoritesOnly && !favoriteModels.includes(model.id)) return false;
      if (activeProviderFilter && model.provider !== activeProviderFilter) return false;
      return true;
    });

    if (!searchQuery.trim()) {
      if (base.length === 0 && models.length > 0) return modelsFromStore.length > 0 ? modelsFromStore : models;
      return base;
    }

    const query = searchQuery.toLowerCase();
    const filtered = base.filter(model =>
      model.name.toLowerCase().includes(query) ||
      model.id.toLowerCase().includes(query) ||
      model.provider.toLowerCase().includes(query) ||
      (model.description && model.description.toLowerCase().includes(query))
    );
    if (filtered.length === 0 && models.length > 0) return modelsFromStore.length > 0 ? modelsFromStore : models;
    return filtered;
  }, [filters, models, showFavoritesOnly, favoriteModels, activeProviderFilter, searchQuery]);

  const recentModelsList = useMemo(() => getRecentModels(), [getRecentModels, models, selectedModel]);

  const favoriteModelsList = useMemo(
    () => filteredModels.filter(model => favoriteModels.includes(model.id)),
    [filteredModels, favoriteModels]
  );

  const nonFavoriteModelsList = useMemo(
    () => filteredModels.filter(model => !favoriteModels.includes(model.id)),
    [filteredModels, favoriteModels]
  );

  const providerGroups = useMemo(() => {
    if (groupMode !== 'provider') return {};
    const groups: Record<string, AIModel[]> = {};
    for (const model of nonFavoriteModelsList) {
      if (!groups[model.provider]) groups[model.provider] = [];
      groups[model.provider].push(model);
    }
    return groups;
  }, [groupMode, nonFavoriteModelsList]);

  const allProviders = useMemo(() => getAllProviders(), [getAllProviders, models]);

  const handleSelect = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    closeExplorer();
  }, [setSelectedModel, closeExplorer]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeExplorer();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => {
        const next = e.key === 'ArrowDown' ? prev + 1 : prev - 1;
        const max = filteredModels.length - 1;
        if (next < 0) return 0;
        if (next > max) return max;
        return next;
      });
    }
    if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredModels.length) {
      handleSelect(filteredModels[focusedIndex].id);
    }
  }, [closeExplorer, filteredModels, focusedIndex, handleSelect]);

  const selectedModelData = getSelectedModelData();

  if (!isExplorerOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-in fade-in duration-150"
        onClick={closeExplorer}
      />

      {/* Panel */}
      <div
        className="fixed inset-0 sm:inset-4 md:inset-6 lg:inset-10 z-50 flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 animate-in fade-in slide-in-from-bottom-4 duration-200 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Search size={16} className="text-indigo-400" />
              Escolher Modelo
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {filteredModels.length} modelo{filteredModels.length !== 1 ? 's' : ''} disponível{filteredModels.length !== 1 ? 'is' : ''}
            </p>
          </div>
          <button
            onClick={closeExplorer}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Model Bar */}
        {selectedModelData && (
          <div className="flex items-center gap-2 px-5 py-2 bg-indigo-500/5 border-b border-indigo-500/10 shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-semibold">Ativo</span>
            <div className="w-1 h-1 rounded-full bg-indigo-400" />
            <p className="text-sm text-zinc-200 font-medium truncate">{selectedModelData.name}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-400 border border-zinc-600/30 shrink-0">
              {friendlyProvider(selectedModelData.provider)}
            </span>
            {selectedModelData.is_free && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 shrink-0">free</span>
            )}
          </div>
        )}

        {/* Search, Presets, Filters */}
        <div className="px-5 py-3 border-b border-zinc-800/50 shrink-0 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar modelos por nome, provedor ou descrição..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setFocusedIndex(-1); }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

      {/* Filter Row: Free, Favorites, Provider Chips, View Toggles */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none items-center flex-wrap">
            <button
              onClick={() => { setFilter('freeOnly', !filters.freeOnly); }}
              className={clsx(
                'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-gradient-to-r',
                filters.freeOnly ? 'from-emerald-500/20 to-green-500/10 border-emerald-500/30 text-emerald-300 hover:border-emerald-400/60' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600',
              )}
            >
              <Gift size={14} /> Gratuito
            </button>
            <button
              onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setFilter('freeOnly', false); }}
              className={clsx(
                'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-gradient-to-r',
                showFavoritesOnly ? 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30 text-yellow-300 hover:border-yellow-400/60' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600',
              )}
            >
              <Star size={14} /> Favoritos
            </button>

            {/* Separator */}
            <div className="w-px h-5 bg-zinc-700 shrink-0" />

            {/* Provider Chips */}
            {allProviders.slice(0, 8).map(provider => (
              <button
                key={provider}
            onClick={() => {
              setActiveProviderFilter(prev => prev === provider ? null : provider);
            }}
                className={clsx(
                  'px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all whitespace-nowrap',
                  activeProviderFilter === provider
                    ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                    : 'border-zinc-700/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                )}
              >
                {friendlyProvider(provider)}
              </button>
            ))}

            {/* Right side: grouping + view toggles */}
            <div className="ml-auto flex items-center gap-1 shrink-0">
              {/* Group by provider toggle */}
              <button
                onClick={() => setGroupMode(prev => prev === 'provider' ? 'flat' : 'provider')}
                className={clsx(
                  'p-1.5 rounded-md border transition-colors',
                  groupMode === 'provider' ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300' : 'border-zinc-700/50 text-zinc-500 hover:text-zinc-300'
                )}
                title="Agrupar por provedor"
              >
                <List size={14} />
              </button>
              {/* Grid / List view toggle */}
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className={clsx(
                  'p-1.5 rounded-md border transition-colors',
                  viewMode === 'list' ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300' : 'border-zinc-700/50 text-zinc-500 hover:text-zinc-300'
                )}
                title={viewMode === 'grid' ? 'Visualização compacta' : 'Visualização em cards'}
              >
                {viewMode === 'grid' ? <List size={14} /> : <LayoutGrid size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Model Content */}
        <main ref={gridRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-3">
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm">Carregando modelos...</p>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
              <Search size={24} />
              <p className="text-sm">Nenhum modelo encontrado</p>
              <button onClick={() => { setActiveProviderFilter(null); setFilter('freeOnly', false); setShowFavoritesOnly(false); }} className="text-xs text-indigo-400 hover:underline">Ver todos os modelos</button>
            </div>
          ) : (
            <>
              {/* Recent Section */}
              {recentModelsList.length > 0 && !showFavoritesOnly && !activeProviderFilter && !searchQuery.trim() && (
                <section className="mb-6">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                    <Clock size={14} className="text-zinc-500" /> Recentes
                  </h3>
                  {viewMode === 'list' ? (
                    <div className="flex flex-col gap-0.5">
                      {recentModelsList.map(model => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isSelected={model.id === selectedModel}
                          onSelect={() => handleSelect(model.id)}
                          compact
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {recentModelsList.map(model => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isSelected={model.id === selectedModel}
                          onSelect={() => handleSelect(model.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Favorites Section */}
              {favoriteModelsList.length > 0 && (
                <section className="mb-6">
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                    <Star size={14} className="text-yellow-400" /> Favoritos
                  </h3>
                  {viewMode === 'list' ? (
                    <div className="flex flex-col gap-0.5">
                      {favoriteModelsList.map(model => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isSelected={model.id === selectedModel}
                          onSelect={() => handleSelect(model.id)}
                          compact
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {favoriteModelsList.map(model => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isSelected={model.id === selectedModel}
                          onSelect={() => handleSelect(model.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* All Models / Provider Grouped */}
              {groupMode === 'provider' ? (
                Object.entries(providerGroups)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([provider, providerModels]) => (
                    <ProviderGroup
                      key={provider}
                      provider={provider}
                      models={providerModels}
                      selectedModel={selectedModel}
                      onSelect={handleSelect}
                      compact={viewMode === 'list'}
                      defaultOpen={providerModels.some(m => m.id === selectedModel)}
                    />
                  ))
              ) : (
                <section>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3">
                    Todos os modelos
                  </h3>
                  {viewMode === 'list' ? (
                    <div className="flex flex-col gap-0.5">
                      {nonFavoriteModelsList.map((model) => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isSelected={model.id === selectedModel}
                          onSelect={() => handleSelect(model.id)}
                          compact
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {nonFavoriteModelsList.map(model => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isSelected={model.id === selectedModel}
                          onSelect={() => handleSelect(model.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </main>

        {/* Keyboard hint */}
        <div className="px-5 py-2 border-t border-zinc-800/50 shrink-0 flex items-center gap-4 text-[10px] text-zinc-600">
          <span><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">↑↓</kbd> navegar</span>
          <span><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">Enter</kbd> selecionar</span>
          <span><kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">Esc</kbd> fechar</span>
        </div>
      </div>
    </>
  );
}
