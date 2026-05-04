'use client';

import { useState, useEffect, useCallback } from 'react';
import { useChatStore } from '@/store/chatStore';
import { AGENT_PROFILES, AgentRole, AgentProfile } from '@/lib/agents';
import {
  Bot,
  Save,
  Info,
  Sparkles,
  MessageSquare,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  Check,
  Edit,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';
import clsx from 'clsx';

export function AgentsView() {
  const { 
    customAgents, 
    agentsLoading, 
    agentsError,
    loadCustomAgents,
    saveAgent,
    deleteAgent
  } = useChatStore();
  
  const [selectedAgentId, setSelectedAgentId] = useState<string | AgentRole>('GERAL');
  const [isEditing, setIsEditing] = useState(false);
  const [isDefaultAgent, setIsDefaultAgent] = useState(true);
  const [agentForm, setAgentForm] = useState({
    nome: '',
    descricao: '',
    emoji: '🤖',
    system_prompt: '',
    ferramentas: [] as string[]
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  
  // Available tools for checkboxes
  const availableTools = [
    { label: 'Buscar na Web', value: 'search_web' },
    { label: 'Buscar Memória', value: 'search_memory' },
    { label: 'Buscar Documentos', value: 'search_documents' },
    { label: 'Analisar Dados', value: 'analyze_data' },
    { label: 'Gerar Código', value: 'generate_code' }
  ];

  // Load custom agents on mount
  useEffect(() => {
    loadCustomAgents();
  }, [loadCustomAgents]);

  // Determine if selected agent is default or custom
  useEffect(() => {
    if (selectedAgentId && typeof selectedAgentId === 'string') {
      const isDefault = Object.values(AGENT_PROFILES).some(agent => agent.id === selectedAgentId);
      setIsDefaultAgent(isDefault);
      
      if (!isDefault) {
        // Find the custom agent to populate form
        const customAgent = customAgents.find(agent => agent.id === selectedAgentId);
        if (customAgent) {
          setAgentForm({
            nome: customAgent.nome,
            descricao: customAgent.descricao || '',
            emoji: customAgent.emoji,
            system_prompt: customAgent.system_prompt,
            ferramentas: customAgent.ferramentas
          });
          setSelectedTools(customAgent.ferramentas);
        }
      } else {
        // Populate form with default agent data
        const defaultAgent = AGENT_PROFILES[selectedAgentId as AgentRole];
        if (defaultAgent) {
          setAgentForm({
            nome: defaultAgent.name,
            descricao: defaultAgent.description,
            emoji: '🤖', // Default emoji for default agents
            system_prompt: defaultAgent.systemPrompt,
            ferramentas: []
          });
          setSelectedTools([]);
        }
      }
    }
  }, [selectedAgentId, customAgents]);

  // Handle tool selection
  const toggleTool = (tool: string) => {
    setSelectedTools(prev => 
      prev.includes(tool) 
        ? prev.filter(t => t !== tool) 
        : [...prev, tool]
    );
  };

  const handleSaveAgent = async () => {
    setIsSaving(true);
    try {
      const agentData = {
        ...agentForm,
        ferramentas: selectedTools,
        is_default: false
      };

      if (isDefaultAgent) {
        // For default agents, we can only update the prompt in local state
        // In a real implementation, you might want to save this as a custom agent
        alert('Agentes padrão não podem ser modificados diretamente. Crie um novo agente baseado neste.');
        setIsSaving(false);
        return;
      }

      if (selectedAgentId && typeof selectedAgentId === 'string' && selectedAgentId !== 'GERAL') {
        // Update existing custom agent
        await saveAgent({
          id: selectedAgentId,
          ...agentData
        });
      } else {
        // Create new custom agent
        await saveAgent(agentData);
      }
      
      setShowForm(false);
      setIsEditing(false);
    } catch (err: any) {
      alert(`Erro ao salvar agente: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!selectedAgentId || typeof selectedAgentId !== 'string') return;
    
    if (window.confirm('Tem certeza que deseja excluir este agente? Esta ação não pode ser desfeita.')) {
      try {
        await deleteAgent(selectedAgentId);
        // Reset selection to first available agent
        const firstAgent = Object.values(AGENT_PROFILES)[0];
        setSelectedAgentId(firstAgent.id);
      } catch (err: any) {
        alert(`Erro ao excluir agente: ${err.message}`);
      }
    }
  };

  const handleNewAgent = () => {
    setIsDefaultAgent(false);
    setIsEditing(false);
    setSelectedAgentId(''); // Clear selection for new agent
    setAgentForm({
      nome: '',
      descricao: '',
      emoji: '🤖',
      system_prompt: '',
      ferramentas: []
    });
    setSelectedTools([]);
    setShowForm(true);
  };

  const handleEditAgent = () => {
    if (isDefaultAgent) {
      alert('Agentes padrão não podem ser editados diretamente. Crie um novo agente baseado neste.');
      return;
    }
    setIsEditing(true);
    setShowForm(true);
  };

  // Get all agents (default + custom) for the list
  const getAllAgents = () => {
    const defaultAgents = Object.values(AGENT_PROFILES).map(agent => ({
      ...agent,
      type: 'default' as const
    }));
    
    const customAgentsList = customAgents.map(agent => ({
      id: agent.id,
      name: agent.nome,
      description: agent.descricao || '',
      emoji: agent.emoji,
      systemPrompt: agent.system_prompt,
      type: 'custom' as const,
      isDefault: agent.is_default
    }));
    
    return [...defaultAgents, ...customAgentsList];
  };

  // Filter agents based on search term
  const filteredAgents = useCallback(() => {
    return getAllAgents().filter(agent => 
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, customAgents]);

  // Get selected agent details
  const getSelectedAgent = () => {
    if (selectedAgentId && typeof selectedAgentId === 'string') {
      // Check if it's a default agent
      const defaultAgent = Object.values(AGENT_PROFILES).find(agent => agent.id === selectedAgentId);
      if (defaultAgent) {
        return {
          ...defaultAgent,
          type: 'default' as const,
          isDefault: true
        };
      }
      
      // Check if it's a custom agent
      const customAgent = customAgents.find(agent => agent.id === selectedAgentId);
      if (customAgent) {
        return {
          id: customAgent.id,
          name: customAgent.nome,
          description: customAgent.descricao || '',
          emoji: customAgent.emoji,
          systemPrompt: customAgent.system_prompt,
          type: 'custom' as const,
          isDefault: customAgent.is_default
        };
      }
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 p-6 overflow-hidden">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full gap-6">
        <div>
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Bot className="text-indigo-400" />
            Gerenciamento de Agentes
          </h2>
          <p className="text-zinc-400 text-sm">
            Crie, edite e gerencie agentes personalizados para o Cuca AI
          </p>
        </div>

        {/* Search and Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative w-48 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                type="text"
                placeholder="Buscar agentes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500 w-full"
              />
            </div>
            <button
              onClick={handleNewAgent}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-md active:scale-95"
            >
              <Plus size={16} />
              Novo Agente
            </button>
          </div>
          
          {agentsError && (
            <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
              <AlertCircle className="text-red-400" size={20} />
              <span>{agentsError}</span>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex flex-1 gap-6 min-h-0">
          {/* Agent List */}
          <div className="w-64 flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
            {filteredAgents().map((agent) => {
              const isSelected = selectedAgentId === agent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={clsx(
                    "flex flex-col items-start p-3 rounded-xl transition-all border text-left",
                    isSelected
                      ? "bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-900/10"
                      : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={clsx(
                      "w-8 h-8 rounded-md flex items-center justify-center",
                      isSelected ? "bg-indigo-500 text-white" : "bg-zinc-800 text-zinc-400"
                    )}>
                      {agent.type === 'default' ? (
                        <Bot size={14} />
                      ) : (
                        <span className="text-lg">{agent.emoji}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm truncate">{agent.name}</span>
                      {agent.type === 'custom' && agent.isDefault && (
                        <span className="ml-2 text-xs bg-indigo-600/20 text-indigo-400 rounded-full px-1.5 py-0.5">Padrão</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500 line-clamp-1">{agent.description}</span>
                </button>
              );
            })}
          </div>

          {/* Agent Editor */}
          <div className="flex-1 flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            {/* Agent Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md flex items-center justify-center">
                  {getSelectedAgent()?.type === 'default' ? (
                    <Bot size={20} className="text-white" />
                  ) : (
                    <span className="text-2xl">{getSelectedAgent()?.emoji}</span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">{getSelectedAgent()?.name || 'Selecione um agente'}</h3>
                  {getSelectedAgent()?.type === 'custom' && (
                    <span className="text-xs text-zinc-500 italic ml-2">
                      {getSelectedAgent()?.isDefault ? '(Padrão)' : '(Customizado)'}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Agent Actions */}
              <div className="flex items-center gap-2">
                {!isDefaultAgent && (
                  <>
                    {isEditing ? (
                      <button
                        onClick={handleSaveAgent}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors shadow-md active:scale-95 disabled:opacity-50"
                      >
                        {isSaving ? <span className="animate-spin text-lg">◌</span> : <Check size={16} />}
                        Salvar
                      </button>
                    ) : (
                      <button
                        onClick={handleEditAgent}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors shadow-md active:scale-95"
                      >
                        <Edit size={16} />
                        Editar
                      </button>
                    )}
                    <button
                      onClick={handleDeleteAgent}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors shadow-md active:scale-95"
                    >
                      <Trash2 size={16} />
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Agent Form (when showing) */}
            {showForm && (
              <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
                <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/50">
                  <div className="mb-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block flex items-center gap-1">
                      <Info size={12} /> Informações Básicas
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">
                          Nome do Agente
                        </label>
                        <input
                          value={agentForm.nome}
                          onChange={(e) => setAgentForm(prev => ({ ...prev, nome: e.target.value }))}
                          placeholder="Ex: Especialista em Vendas"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 block">
                          Emoji
                        </label>
                        <input
                          value={agentForm.emoji}
                          onChange={(e) => setAgentForm(prev => ({ ...prev, emoji: e.target.value }))}
                          maxLength={2}
                          placeholder="🤖"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center text-lg font-bold text-zinc-200 focus:border-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block">
                        Descrição
                      </label>
                      <textarea
                        value={agentForm.descricao}
                        onChange={(e) => setAgentForm(prev => ({ ...prev, descricao: e.target.value }))}
                        rows={3}
                        placeholder="Descreva brevemente o propósito deste agente..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:border-indigo-500 outline-none resize-none"
                      />
                    </div>
                  </div>
                  
                  <div className="border-t border-zinc-800 pt-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block flex items-center gap-2">
                      <Sparkles size={12} className="text-indigo-400" />
                      System Prompt (Instruções de Comportamento)
                    </label>
                    <textarea
                      value={agentForm.system_prompt}
                      onChange={(e) => setAgentForm(prev => ({ ...prev, system_prompt: e.target.value }))}
                      rows={8}
                      placeholder="Defina como o agente deve agir, seu tom de voz, expertise, etc..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm font-mono text-indigo-300/90 focus:border-indigo-500 outline-none resize-none"
                    />
                  </div>
                  
                  <div className="border-t border-zinc-800 pt-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block flex items-center gap-2">
                      <MessageSquare size={12} /> Ferramentas Disponíveis
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {availableTools.map((tool) => (
                        <label key={tool.value} className="flex items-center gap-2 p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl cursor-pointer transition-colors hover:bg-zinc-800/50">
                          <input
                            type="checkbox"
                            checked={selectedTools.includes(tool.value)}
                            onChange={() => toggleTool(tool.value)}
                            className="h-4 w-4 text-indigo-600 bg-zinc-900 border-zinc-700 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm text-zinc-200">{tool.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Agent Preview (when not showing form) */}
            {!showForm && (
              <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
                <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/50">
                  <div className="mb-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block flex items-center gap-1">
                      <Info size={12} /> Informações do Agente
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-zinc-500 w-20">Nome:</span>
                        <span className="text-zinc-300">{getSelectedAgent()?.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-zinc-500 w-20">Emoji:</span>
                        <span className="text-lg">{getSelectedAgent()?.emoji}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-zinc-500 w-20">Tipo:</span>
                        <span className={clsx(
                          "text-xs font-bold px-2 py-0.5 rounded",
                          getSelectedAgent()?.type === 'default' 
                            ? "bg-indigo-600/20 text-indigo-400" 
                            : getSelectedAgent()?.isDefault
                              ? "bg-green-600/20 text-green-400"
                              : "bg-zinc-600/20 text-zinc-400"
                        )}>
                          {getSelectedAgent()?.type === 'default' ? 'Padrão' : getSelectedAgent()?.isDefault ? 'Padrão (Customizado)' : 'Customizado'}
                        </span>
                      </div>
                      {getSelectedAgent()?.description && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-zinc-500 w-20">Descrição:</span>
                          <span className="text-zinc-300">{getSelectedAgent()?.description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="border-t border-zinc-800 pt-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block flex items-center gap-2">
                      <Sparkles size={12} className="text-indigo-400" />
                      System Prompt Atual
                    </label>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs text-indigo-300/90">
                      {getSelectedAgent()?.systemPrompt || 'Nenhum system prompt definido'}
                    </div>
                  </div>
                  
                  <div className="border-t border-zinc-800 pt-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block flex items-center gap-2">
                      <MessageSquare size={12} /> Ferramentas Ativas
                    </label>
                    {getSelectedAgent()?.type === 'custom' ? (
                      <>
                        {selectedTools.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedTools.map((tool) => {
                              const toolInfo = availableTools.find(t => t.value === tool);
                              return (
                                <span key={tool} className="bg-indigo-600/20 text-indigo-400 text-xs px-3 py-1 rounded-full">
                                  {toolInfo?.label || tool}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-500 italic">Nenhuma ferramenta selecionada</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-zinc-500 italic">Agentes padrão não configuram ferramentas diretamente</p>
                    )}
                  </div>
                </div>
                
                {/* Tips and Suggestions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-700/30">
                    <h4 className="text-xs font-bold uppercase text-zinc-500 mb-2 flex items-center gap-2">
                      <MessageSquare size={12} /> Sugestão de Uso
                    </h4>
                    <p className="text-xs text-zinc-400">
                      Use agentes especializados para tarefas específicas como análise de dados, programação ou pesquisa.
                    </p>
                  </div>
                  <div className="bg-indigo-600/5 p-4 rounded-xl border border-indigo-500/20">
                    <h4 className="text-xs font-bold uppercase text-indigo-400/70 mb-2 flex items-center gap-2">
                      <Sparkles size={12} /> Dica Pro
                    </h4>
                    <p className="text-xs text-zinc-400">
                      Comece clonando um agente padrão e depois personalize conforme suas necessidades.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}