'use client';

import { useModelsStore, AIModel, ModelPreset } from '@/store/modelsStore';
import { X, Search, Cpu, Zap, Trophy, Gift, Code2, Brain, Check } from 'lucide-react';
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
  };
  return map[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

// ─── Preset Configs ───────────────────────────────────────────────────────────

const PRESETS: { id: ModelPreset; label: string; icon: React.ReactNode; color: string }[] = [
  {
    id: 'best_overall',
    label: 'Melhor Geral',
    icon: <Trophy size={14} />,
    color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-300 hover:border-amber-400/60',
  },
  {
    id: 'best_free',
    label: 'Melhor Grátis',
    icon: <Gift size={14} />,
    color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30 text-emerald-300 hover:border-emerald-400/60',
  },
  {
    id: 'best_code',
    label: 'Melhor Código',
    icon: <Code2 size={14} />,
    color: 'from-sky-500/20 to-cyan-500/10 border-sky-500/30 text-sky-300 hover:border-sky-400/60',
  },
  {
    id: 'best_reasoning',
    label: 'Melhor Raciocínio',
    icon: <Brain size={14} />,
    color: 'from-violet-500/20 to-purple-500/10 border-violet-500/30 text-violet-300 hover:border-violet-400/60',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModelCard({ model, isSelected, onSelect }: {
  model: AIModel;
  isSelected: boolean;
  onSelect: () => void;
}) {
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
          <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-zinc-700/40 text-zinc-300 border-zinc-600/30">
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

      {/* Tags */}
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
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ModelExplorer() {
  const {
    isExplorerOpen, closeExplorer, selectedModel, setSelectedModel,
    activePreset, setPreset, getFilteredModels, models, isLoading, fetchModels, refreshModels,
  } = useModelsStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isExplorerOpen) return;

    if (models.length === 0) {
      fetchModels();
      return;
    }

    // force a fresh pull each time explorer opens
    refreshModels();
  }, [isExplorerOpen, models.length, fetchModels, refreshModels]);

  const filteredModels = useMemo(() => {
    const modelsFromPreset = getFilteredModels();
    if (!searchQuery.trim()) return modelsFromPreset;

    const query = searchQuery.toLowerCase();
    return modelsFromPreset.filter(model =>
      model.name.toLowerCase().includes(query) ||
      model.id.toLowerCase().includes(query) ||
      model.provider.toLowerCase().includes(query) ||
      (model.description && model.description.toLowerCase().includes(query))
    );
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    models, activePreset, searchQuery
  ]);

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

        {/* Search and Presets */}
        <div className="px-5 py-3 border-b border-zinc-800/50 shrink-0">
          {/* Search Input */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar modelos por nome, provedor ou descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* Presets */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
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
        </div>

        {/* Model Grid */}
        <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-3">
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm">Carregando modelos...</p>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
              <Search size={24} />
              <p className="text-sm">Nenhum modelo encontrado</p>
              <button onClick={() => setPreset(null)} className="text-xs text-indigo-400 hover:underline">Ver todos os modelos</button>
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
    </>
  );
}
