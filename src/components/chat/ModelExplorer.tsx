'use client';

import { useModelsStore, AIModel, ModelPreset, ModelFilters } from '@/store/modelsStore';
import {
  X, Search, Cpu, Eye, Wrench, FileJson, Zap, ChevronRight,
  Trophy, Gift, Code2, Brain, ImageIcon, Star, RotateCcw, Check
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
    microsoft: 'Microsoft',
    cohere: 'Cohere',
    qwen: 'Qwen',
    '01-ai': '01.AI',
    perplexity: 'Perplexity',
    xai: 'xAI',
    bytedance: 'ByteDance',
  };
  return map[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  openai: 'bg-green-500/20 text-green-300 border-green-500/30',
  google: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  mistralai: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'meta-llama': 'bg-blue-400/20 text-blue-200 border-blue-400/30',
  deepseek: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  xai: 'bg-zinc-400/20 text-zinc-200 border-zinc-400/30',
  microsoft: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  qwen: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};
const defaultProvColor = 'bg-zinc-700/40 text-zinc-300 border-zinc-600/30';

const TAG_COLORS: Record<string, string> = {
  free: 'bg-emerald-500/20 text-emerald-300',
  code: 'bg-sky-500/20 text-sky-300',
  reasoning: 'bg-purple-500/20 text-purple-300',
  chat: 'bg-zinc-600/40 text-zinc-300',
  vision: 'bg-yellow-500/20 text-yellow-300',
};

// ─── Preset Configs ───────────────────────────────────────────────────────────

const PRESETS: { id: ModelPreset; label: string; icon: React.ReactNode; color: string }[] = [
  {
    id: 'best_overall',
    label: 'Melhor Geral',
    icon: <Trophy size={13} />,
    color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-300 hover:border-amber-400/60',
  },
  {
    id: 'best_free',
    label: 'Melhor Grátis',
    icon: <Gift size={13} />,
    color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30 text-emerald-300 hover:border-emerald-400/60',
  },
  {
    id: 'best_code',
    label: 'Melhor Código',
    icon: <Code2 size={13} />,
    color: 'from-sky-500/20 to-cyan-500/10 border-sky-500/30 text-sky-300 hover:border-sky-400/60',
  },
  {
    id: 'best_reasoning',
    label: 'Melhor Raciocínio',
    icon: <Brain size={13} />,
    color: 'from-violet-500/20 to-purple-500/10 border-violet-500/30 text-violet-300 hover:border-violet-400/60',
  },
  {
    id: 'best_image',
    label: 'Melhor Imagem',
    icon: <ImageIcon size={13} />,
    color: 'from-rose-500/20 to-pink-500/10 border-rose-500/30 text-rose-300 hover:border-rose-400/60',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CapabilityBadge({ active, icon, label }: { active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span
      title={label}
      className={clsx(
        'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors',
        active
          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
          : 'bg-zinc-800/50 text-zinc-600 border-zinc-700/30'
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function ModelCard({ model, isSelected, onSelect }: {
  model: AIModel;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const provColor = PROVIDER_COLORS[model.provider] ?? defaultProvColor;

  return (
    <button
      onClick={onSelect}
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

      {/* Header row */}
      <div className="flex items-start gap-2 mb-2 pr-6">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate leading-tight">{model.name}</p>
          <span className={clsx(
            'inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium border',
            provColor
          )}>
            {friendlyProvider(model.provider)}
          </span>
        </div>
      </div>

      {/* Stats row */}
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

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        <CapabilityBadge active={model.capabilities.vision} icon={<Eye size={9} />} label="Vision" />
        <CapabilityBadge active={model.capabilities.tools} icon={<Wrench size={9} />} label="Tools" />
        <CapabilityBadge active={model.capabilities.json_mode} icon={<FileJson size={9} />} label="JSON" />
      </div>

      {/* Tags */}
      {model.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {model.tags.slice(0, 4).map(tag => (
            <span
              key={tag}
              className={clsx(
                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                TAG_COLORS[tag] ?? 'bg-zinc-700/40 text-zinc-400'
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">{title}</p>
      {children}
    </div>
  );
}

function ToggleChip({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
        active
          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
          : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
      )}
    >
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ModelExplorer() {
  const {
    isExplorerOpen, closeExplorer, selectedModel, setSelectedModel,
    filters, setFilter, resetFilters, activePreset, setPreset,
    getAllProviders, getFilteredModels, models, isLoading, fetchModels,
  } = useModelsStore();

  useEffect(() => {
    if (isExplorerOpen && models.length === 0) fetchModels();
  }, [isExplorerOpen, models.length, fetchModels]);

  const filteredModels = useMemo(() => getFilteredModels(), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    models, filters, activePreset
  ]);

  const allProviders = useMemo(() => getAllProviders(), [models]); // eslint-disable-line

  const toggleArrayFilter = (key: 'providers' | 'modalities' | 'tags', value: string) => {
    const current = filters[key] as string[];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setFilter(key, next);
  };

  if (!isExplorerOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-in fade-in duration-150"
        onClick={closeExplorer}
      />

      {/* Panel */}
      <div className="fixed inset-4 sm:inset-6 lg:inset-10 z-50 flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 animate-in fade-in slide-in-from-bottom-4 duration-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Star size={16} className="text-indigo-400" />
              Explorador de Modelos
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {filteredModels.length} modelo{filteredModels.length !== 1 ? 's' : ''} disponíve{filteredModels.length !== 1 ? 'is' : 'l'}
            </p>
          </div>
          <button
            onClick={closeExplorer}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Presets */}
        <div className="flex gap-2 px-5 py-3 border-b border-zinc-800/50 overflow-x-auto shrink-0 scrollbar-none">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(activePreset === p.id ? null : p.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap bg-gradient-to-r transition-all duration-150 shrink-0',
                p.color,
                activePreset === p.id ? 'opacity-100 ring-1 ring-current/50' : 'opacity-70 hover:opacity-100'
              )}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar – Filters */}
          <aside className="w-52 shrink-0 border-r border-zinc-800/50 overflow-y-auto p-4 hidden sm:block custom-scrollbar">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-zinc-300">Filtros</p>
              <button onClick={resetFilters} className="text-zinc-500 hover:text-zinc-300 transition-colors" title="Limpar filtros">
                <RotateCcw size={12} />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-5">
              <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar modelos..."
                value={filters.search}
                onChange={e => setFilter('search', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>

            <FilterSection title="Preço">
              <div className="flex flex-col gap-1">
                {[
                  { label: 'Grátis', action: () => setFilter('freeOnly', !filters.freeOnly), active: filters.freeOnly },
                  { label: '< $1 / 1M', action: () => setFilter('maxPricePrompt', filters.maxPricePrompt === 1 ? null : 1), active: filters.maxPricePrompt === 1 },
                  { label: '< $5 / 1M', action: () => setFilter('maxPricePrompt', filters.maxPricePrompt === 5 ? null : 5), active: filters.maxPricePrompt === 5 },
                  { label: '< $20 / 1M', action: () => setFilter('maxPricePrompt', filters.maxPricePrompt === 20 ? null : 20), active: filters.maxPricePrompt === 20 },
                ].map(({ label, action, active }) => (
                  <ToggleChip key={label} active={active} onClick={action}>{label}</ToggleChip>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Tipo">
              <div className="flex flex-col gap-1">
                {['text', 'image', 'multimodal'].map(m => (
                  <ToggleChip
                    key={m}
                    active={filters.modalities.includes(m)}
                    onClick={() => toggleArrayFilter('modalities', m)}
                  >
                    {m === 'text' ? 'Texto' : m === 'image' ? 'Imagem' : 'Multimodal'}
                  </ToggleChip>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Capacidades">
              <div className="flex flex-col gap-1">
                {(['code', 'reasoning', 'vision', 'chat'] as const).map(tag => (
                  <ToggleChip
                    key={tag}
                    active={filters.tags.includes(tag)}
                    onClick={() => toggleArrayFilter('tags', tag)}
                  >
                    {tag === 'code' ? '💻 Código' : tag === 'reasoning' ? '🧠 Raciocínio' : tag === 'vision' ? '👁 Visão' : '💬 Chat'}
                  </ToggleChip>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Contexto">
              <div className="flex flex-col gap-1">
                {[
                  { label: '8k+', value: 8_000 },
                  { label: '32k+', value: 32_000 },
                  { label: '128k+', value: 128_000 },
                  { label: '1M+', value: 1_000_000 },
                ].map(({ label, value }) => (
                  <ToggleChip
                    key={label}
                    active={filters.minContext === value}
                    onClick={() => setFilter('minContext', filters.minContext === value ? null : value)}
                  >
                    {label}
                  </ToggleChip>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Provedor">
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {allProviders.map(p => (
                  <ToggleChip
                    key={p}
                    active={filters.providers.includes(p)}
                    onClick={() => toggleArrayFilter('providers', p)}
                  >
                    {friendlyProvider(p)}
                  </ToggleChip>
                ))}
              </div>
            </FilterSection>
          </aside>

          {/* Model Grid */}
          <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {/* Mobile Search */}
            <div className="relative mb-4 sm:hidden">
              <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar modelos..."
                value={filters.search}
                onChange={e => setFilter('search', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-3">
                <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-sm">Carregando modelos...</p>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
                <Search size={24} />
                <p className="text-sm">Nenhum modelo encontrado</p>
                <button onClick={resetFilters} className="text-xs text-indigo-400 hover:underline">Limpar filtros</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredModels.map(model => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    isSelected={model.id === selectedModel}
                    onSelect={() => {
                      setSelectedModel(model.id);
                      closeExplorer();
                    }}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
