'use client';

import { useModelsStore } from '@/store/modelsStore';
import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import { Bot, Paperclip, Globe, Settings, ChevronDown, LogOut, Loader2, ChevronRight, Menu, X, Edit2, Check, Wrench, Server, Star, Clock, Folder } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

import { AGENT_PROFILES, AgentRole } from '@/lib/agents';
import { useUIStore } from '@/store/uiStore';
import McpSettings from './McpSettings';

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
    openExplorer, getSelectedModelData, isLoading, selectedAgent, setSelectedAgent,
    getRecentModels, favoriteModels, isFavorite
  } = useModelsStore();
  const { customAgents, loadCustomAgents, projects, fetchProjects, moveConversationToProject } = useChatStore();
  const { isMobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const { currentConversationId, conversations, updateConversationTitle, currentProjectId, setCurrentProjectId } = useChatStore();

  const router = useRouter();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMcpOpen, setIsMcpOpen] = useState(false);
  const [isQuickSelectOpen, setIsQuickSelectOpen] = useState(false);
  const [isProjectSelectOpen, setIsProjectSelectOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const quickSelectRef = useRef<HTMLDivElement>(null);
  const projectSelectRef = useRef<HTMLDivElement>(null);

  const currentChat = conversations.find(c => c.con_id === currentConversationId);
  const currentProject = projects.find(p => p.pro_id === (currentChat?.con_projeto_id || currentProjectId));

  // Load projects
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Close project selector on outside click
  useEffect(() => {
    if (!isProjectSelectOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (projectSelectRef.current && !projectSelectRef.current.contains(e.target as Node)) {
        setIsProjectSelectOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProjectSelectOpen]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    loadCustomAgents();
  }, [loadCustomAgents]);

  useEffect(() => {
    const interval = setInterval(() => {
      // keep list fresher in long-lived sessions
      refreshModels();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshModels]);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (!isQuickSelectOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (quickSelectRef.current && !quickSelectRef.current.contains(e.target as Node)) {
        setIsQuickSelectOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isQuickSelectOpen]);

  const recentModels = useModelsStore.getState().getRecentModels();
  const favoriteModelList = models.filter(m => favoriteModels.includes(m.id)).slice(0, 5);

  const selectedModelData = getSelectedModelData();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const startEditing = () => {
    if (currentChat) {
      setEditTitleValue(currentChat.con_titulo);
      setIsEditingTitle(true);
    }
  };

  const saveTitle = async () => {
    if (currentConversationId && editTitleValue.trim() && editTitleValue.trim() !== currentChat?.con_titulo) {
      await updateConversationTitle(currentConversationId, editTitleValue.trim());
    }
    setIsEditingTitle(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const handleOpenAgentSelector = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  return (
    <>
      <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 shrink-0 shadow-sm z-10 w-full relative">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

        {/* Model Quick Select */}
        <div className="relative" ref={quickSelectRef}>
          <button
            onClick={() => setIsQuickSelectOpen(!isQuickSelectOpen)}
            disabled={isLoading}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all max-w-[120px] sm:max-w-[220px]',
              'bg-zinc-900 border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/80',
              'focus:outline-none focus:ring-1 focus:ring-indigo-500/50',
              'disabled:opacity-50 disabled:cursor-wait shadow-sm',
              isQuickSelectOpen && 'border-indigo-500/50 bg-zinc-800/80'
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
            <ChevronDown size={12} className={clsx('text-zinc-500 shrink-0 transition-transform', isQuickSelectOpen && 'rotate-180')} />
          </button>

          {/* Quick Select Popover */}
          {isQuickSelectOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl shadow-black/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              {/* Current Model */}
              {selectedModelData && (
                <div className="px-3 py-2.5 border-b border-zinc-800 bg-indigo-500/5">
                  <p className="text-[10px] uppercase tracking-wider text-indigo-400 font-semibold mb-1">Modelo ativo</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-zinc-200 font-medium truncate">{selectedModelData.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-400 border border-zinc-600/30 shrink-0">
                      {shortProvider(selectedModel)}
                    </span>
                  </div>
                </div>
              )}

              {/* Favorites */}
              {favoriteModelList.length > 0 && (
                <div className="px-3 py-2 border-b border-zinc-800/50">
                  <p className="text-[10px] uppercase tracking-wider text-yellow-400 font-semibold mb-1.5 flex items-center gap-1">
                    <Star size={10} /> Favoritos
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {favoriteModelList.map(model => (
                      <button
                        key={model.id}
                        onClick={() => { setSelectedModel(model.id); setIsQuickSelectOpen(false); }}
                        className={clsx(
                          'flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors w-full',
                          model.id === selectedModel ? 'bg-indigo-500/10 text-indigo-300' : 'text-zinc-300 hover:bg-zinc-800'
                        )}
                      >
                        {model.id === selectedModel && <Check size={12} className="shrink-0 text-indigo-400" />}
                        <span className="text-sm truncate">{model.name}</span>
                        <span className="text-[10px] text-zinc-500 shrink-0 ml-auto">{shortProvider(model.id)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent */}
              {recentModels.length > 0 && (
                <div className="px-3 py-2 border-b border-zinc-800/50">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5 flex items-center gap-1">
                    <Clock size={10} /> Recentes
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {recentModels.filter(m => m.id !== selectedModel).slice(0, 3).map(model => (
                      <button
                        key={model.id}
                        onClick={() => { setSelectedModel(model.id); setIsQuickSelectOpen(false); }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-zinc-300 hover:bg-zinc-800 transition-colors w-full"
                      >
                        <span className="text-sm truncate">{model.name}</span>
                        <span className="text-[10px] text-zinc-500 shrink-0 ml-auto">{shortProvider(model.id)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Explore All */}
              <button
                onClick={() => { setIsQuickSelectOpen(false); openExplorer(); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-indigo-400 hover:bg-indigo-500/10 transition-colors font-medium"
              >
                Explorar todos os modelos <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

          {/* Agent name on mobile - FIXED: now shows on mobile */}
          <div className="flex sm:hidden items-center gap-1 text-zinc-400 text-[10px]">
            <Bot size={12} />
            <span className="truncate">{(AGENT_PROFILES as Record<string, any>)[selectedAgent]?.name ?? selectedAgent}</span>
          </div>

          {/* Agent Selector - desktop only */}
          <div className="relative group hidden sm:block">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value as any)}
              className="appearance-none flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-md px-3 py-1.5 pl-8 hover:border-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer shadow-sm w-[110px] sm:w-[160px] truncate"
            >
              {/* Default agents */}
              {Object.values(AGENT_PROFILES).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
              {/* Custom agents */}
              {customAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.nome}
                </option>
              ))}
            </select>
            <Bot size={16} className="text-zinc-400 absolute left-2.5 top-2 pointer-events-none" />
            <ChevronDown className="absolute right-2.5 top-2 text-zinc-400 pointer-events-none" size={14} />
          </div>
        </div>

        {/* Project Badge */}
        {currentChat && (
          <div className="relative" ref={projectSelectRef}>
            <button
              onClick={() => setIsProjectSelectOpen(!isProjectSelectOpen)}
              className={clsx(
                "hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all max-w-[130px]",
                currentProject
                  ? "bg-zinc-900 border border-zinc-700/50 text-zinc-300 hover:border-zinc-600"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
              title="Mover para projeto"
            >
              <Folder size={12} className="shrink-0" />
              <span className="truncate">{currentProject?.pro_nome || 'Sem projeto'}</span>
              <ChevronDown size={10} className="shrink-0 text-zinc-600" />
            </button>

            {isProjectSelectOpen && (
              <div className="absolute top-full left-0 mt-1 w-44 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                <button
                  onClick={() => {
                    if (currentConversationId) {
                      moveConversationToProject(currentConversationId, '');
                      setCurrentProjectId(null);
                    }
                    setIsProjectSelectOpen(false);
                  }}
                  className={clsx(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors",
                    !currentProject ? "text-indigo-300 bg-indigo-500/10" : "text-zinc-400 hover:bg-zinc-800"
                  )}
                >
                  <Folder size={12} /> Sem projeto
                </button>
                {projects.map(p => (
                  <button
                    key={p.pro_id}
                    onClick={() => {
                      if (currentConversationId) {
                        moveConversationToProject(currentConversationId, p.pro_id);
                        setCurrentProjectId(p.pro_id);
                      }
                      setIsProjectSelectOpen(false);
                    }}
                    className={clsx(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors",
                      currentProject?.pro_id === p.pro_id ? "text-indigo-300 bg-indigo-500/10" : "text-zinc-400 hover:bg-zinc-800"
                    )}
                  >
                    <span>{p.pro_emoji}</span>
                    <span className="truncate">{p.pro_nome}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Center section: Chat Title */}
        <div className="hidden md:flex flex-1 items-center justify-center min-w-0 px-4">
          {currentChat && (
            <div className="group flex items-center max-w-[300px] gap-2">
              {isEditingTitle ? (
                <div className="flex items-center w-full relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={onKeyDown}
                    className="w-full bg-zinc-900 border border-indigo-500/50 text-zinc-100 text-sm rounded-md px-3 py-1 outline-none focus:ring-1 focus:ring-indigo-500 pr-8 shadow-sm"
                  />
                  <button
                    onMouseDown={(e) => { e.preventDefault(); saveTitle(); }}
                    className="absolute right-2 text-zinc-400 hover:text-indigo-400"
                  >
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md hover:bg-zinc-800/50 transition-colors w-full"
                  onClick={startEditing}
                  title="Renomear chat"
                >
                  <div className="font-semibold text-sm text-zinc-300 truncate text-center flex-1">
                    {currentChat.con_titulo}
                  </div>
                  <Edit2 size={12} className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 flex-1 sm:flex-none">

          {/* Wrench icon now opens agent selector on mobile */}
          <HeaderAction
            icon={<Wrench size={18} />}
            tooltip="Configurar Agente"
            onClick={handleOpenAgentSelector}
          />

          {/* MCP Settings */}
          <HeaderAction
            icon={<Server size={18} />}
            tooltip="Configurar MCP"
            onClick={() => setIsMcpOpen(true)}
          />

          <div className="w-px h-6 bg-zinc-800 mx-1 hidden sm:block" />

          <HeaderAction
            icon={<LogOut size={18} />}
            tooltip="Sair"
            onClick={handleLogout}
            className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
          />
        </div>
      </header>
      
      {/* Settings Dropdown (mobile) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:hidden">
          <div className="relative w-full max-w-xs mx-auto">
            <div className="bg-zinc-950 border border-zinc-800 rounded-t-lg shadow-lg">
              {/* Agent Selector */}
              <div className="px-4 py-3 border-b border-zinc-800">
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Agente Ativo
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => {
                    setSelectedAgent(e.target.value as AgentRole);
                    setIsSettingsOpen(false);
                  }}
                  className="w-full appearance-none flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-md px-3 py-1.5 pl-8 hover:border-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer shadow-sm"
                >
                  {Object.values(AGENT_PROFILES).map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                  {customAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.nome}
                    </option>
                  ))}
                </select>
                <Bot size={16} className="text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                <ChevronDown className="absolute right-3 top-2.5 text-zinc-400 pointer-events-none" size={14} />
              </div>
               
              {/* Project Selector (mobile) */}
              <div className="px-4 py-3 border-b border-zinc-800">
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Projeto
                </label>
                <div className="flex items-center gap-2">
                  <Folder size={14} className="text-zinc-500 shrink-0" />
                  <select
                    value={currentProject?.pro_id || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (currentConversationId) {
                        moveConversationToProject(currentConversationId, val || '');
                        setCurrentProjectId(val || null);
                      }
                    }}
                    className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-md px-2 py-1.5 outline-none"
                  >
                    <option value="">Sem projeto</option>
                    {projects.map(p => (
                      <option key={p.pro_id} value={p.pro_id}>{p.pro_emoji} {p.pro_nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rename Chat */}
              <div className="px-4 py-3">
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Renomear Conversa
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={onKeyDown}
                    className="flex-1 bg-zinc-900 border border-indigo-500/50 text-zinc-100 text-sm rounded-md px-3 py-1 outline-none focus:ring-1 focus:ring-indigo-500 pr-8 shadow-sm"
                  />
                  <button
                    onMouseDown={(e) => { e.preventDefault(); saveTitle(); setIsSettingsOpen(false); }}
                    className="text-zinc-400 hover:text-indigo-400"
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
        </div>
      )}

      {/* MCP Settings Modal */}
      {isMcpOpen && <McpSettings onClose={() => setIsMcpOpen(false)} />}
    </>
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
