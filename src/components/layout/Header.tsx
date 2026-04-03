'use client';

import { useModelsStore } from '@/store/modelsStore';
import { useEffect, useRef, useState } from 'react';
import { Bot, Paperclip, Globe, Wrench, ChevronDown, LogOut, Loader2, ChevronRight, Menu, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

import { AGENT_PROFILES, AgentRole } from '@/lib/agents';
import { useUIStore } from '@/store/uiStore';

// Provider friendly name (short)
function shortProvider(id: string): string {
  const prov = id.split('/')[0];
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
    xai: 'xAI',
    perplexity: 'Pplx',
  };
  return map[prov] ?? prov;
}

export function Header() {
  const {
    models, fetchModels, refreshModels, selectedModel, setSelectedModel,
    openExplorer, getSelectedModelData, isLoading
  } = useModelsStore();
  const { selectedAgent, setSelectedAgent } = useModelsStore();
  const { isMobileMenuOpen, setMobileMenuOpen } = useUIStore();

  const router = useRouter();

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    const interval = setInterval(() => {
      // keep list fresher in long-lived sessions
      refreshModels();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshModels]);

  const selectedModelData = getSelectedModelData();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };


  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 shrink-0 shadow-sm z-10 w-full relative">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          title={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Model Explorer Trigger */}
        <button
          onClick={openExplorer}
          disabled={isLoading}
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all max-w-[140px] sm:max-w-[220px]',
            'bg-zinc-900 border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/80',
            'focus:outline-none focus:ring-1 focus:ring-indigo-500/50',
            'disabled:opacity-50 disabled:cursor-wait shadow-sm',
          )}
          title="Explorar modelos"
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin text-zinc-400 shrink-0" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 shadow-sm shadow-indigo-500/50" />
          )}
          <span className="text-zinc-200 truncate font-medium text-xs leading-none">
            {selectedModelData?.name ?? (selectedModel.split('/')[1] ?? selectedModel)}
          </span>
          {selectedModelData && (
            <span className="text-zinc-500 text-[10px] shrink-0 hidden sm:block">
              {shortProvider(selectedModel)}
            </span>
          )}
          <ChevronDown size={12} className="text-zinc-500 shrink-0" />
        </button>

        {/* Agent Selector */}
        <div className="relative group">
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value as AgentRole)}
            className="appearance-none flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-md px-3 py-1.5 pl-8 hover:border-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer shadow-sm w-[110px] sm:w-[160px] truncate"
          >
            {Object.values(AGENT_PROFILES).map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <Bot size={16} className="text-zinc-400 absolute left-2.5 top-2 pointer-events-none" />
          <ChevronDown className="absolute right-2.5 top-2 text-zinc-400 pointer-events-none" size={14} />
        </div>
      </div>

      <div className="flex items-center gap-2">

        <HeaderAction
          icon={<Wrench size={18} />}
          tooltip="Configurar Ferramentas"
          onClick={() => alert('Configurações de ferramentas em breve!')}
        />

        <div className="w-px h-6 bg-zinc-800 mx-1" />

        <HeaderAction
          icon={<LogOut size={18} />}
          tooltip="Sair"
          onClick={handleLogout}
          className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
        />
      </div>
    </header>
  );
}

function HeaderAction({
  icon,
  tooltip,
  onClick,
  active = false,
  disabled = false,
  className = ""
}: {
  icon: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "p-2 rounded-md transition-colors relative group",
        active ? "text-indigo-400 bg-indigo-500/10" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      title={tooltip}
    >
      {icon}
      <span className="absolute -bottom-8 right-0 bg-zinc-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:block pointer-events-none border border-zinc-700 shadow-md">
        {tooltip}
      </span>
    </button>
  );
}
