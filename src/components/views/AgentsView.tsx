'use client';

import { useState } from 'react';
import { AGENT_PROFILES, AgentRole } from '@/lib/agents';
import { Bot, Save, Info, Sparkles, MessageSquare } from 'lucide-react';
import clsx from 'clsx';

export function AgentsView() {
  const [selectedAgentId, setSelectedAgentId] = useState<AgentRole>('GERAL');
  const [prompts, setPrompts] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(AGENT_PROFILES).map(([id, profile]) => [id, profile.systemPrompt])
    )
  );
  const [isSaving, setIsSaving] = useState(false);

  const selectedAgent = AGENT_PROFILES[selectedAgentId];

  const handleSave = async () => {
    setIsSaving(true);
    // Simulating save to DB (will implement table later if needed, 
    // for now it can be local state or we can add the table logic)
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsSaving(false);
    alert('Prompt do agente atualizado com sucesso (Local/Session)!');
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 p-6 overflow-hidden">
      <div className="max-w-5xl mx-auto w-full flex flex-col h-full gap-6">
        <div>
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Bot className="text-indigo-400" />
            Configuração de Agentes
          </h2>
          <p className="text-zinc-400 text-sm">
            Personalize o comportamento e as instruções de cada agente especializado.
          </p>
        </div>

        <div className="flex flex-1 gap-6 min-h-0">
          {/* Agent List */}
          <div className="w-64 flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
            {Object.values(AGENT_PROFILES).map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={clsx(
                  "flex flex-col items-start p-3 rounded-xl transition-all border text-left",
                  selectedAgentId === agent.id
                    ? "bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-900/10"
                    : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={clsx(
                    "w-6 h-6 rounded-md flex items-center justify-center",
                    selectedAgentId === agent.id ? "bg-indigo-500 text-white" : "bg-zinc-800 text-zinc-400"
                  )}>
                    <Bot size={14} />
                  </div>
                  <span className="font-medium text-sm">{agent.name}</span>
                </div>
                <span className="text-xs text-zinc-500 line-clamp-1">{agent.description}</span>
              </button>
            ))}
          </div>

          {/* Prompt Editor */}
          <div className="flex-1 flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shadow-inner">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">{selectedAgent.name}</h3>
                  <span className="text-xs text-zinc-500 italic">{selectedAgent.id}</span>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-md active:scale-95 disabled:opacity-50"
              >
                {isSaving ? <span className="animate-spin text-lg">◌</span> : <Save size={16} />}
                Salvar Prompt
              </button>
            </div>

            <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block flex items-center gap-1">
                  <Info size={12} /> Descrição do Agente
                </label>
                <p className="text-sm text-zinc-300 bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50 leading-relaxed text-balance">
                  {selectedAgent.description}
                </p>
              </div>

              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 block flex items-center gap-2">
                  <Sparkles size={12} className="text-indigo-400" />
                  System Prompt (Instruções de Comportamento)
                </label>
                <textarea
                  value={prompts[selectedAgentId]}
                  onChange={(e) => setPrompts({ ...prompts, [selectedAgentId]: e.target.value })}
                  className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm font-mono text-indigo-300/90 focus:border-indigo-500 outline-none transition-colors resize-none leading-relaxed shadow-inner shadow-black/50"
                  placeholder="Defina como o agente deve agir..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-700/30">
                  <h4 className="text-xs font-bold uppercase text-zinc-500 mb-2 flex items-center gap-2">
                    <MessageSquare size={12} /> Sugestão de Teste
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Mude o tom para "bem sarcástico" ou "mestre ancião" e teste no chat.
                  </p>
                </div>
                <div className="bg-indigo-600/5 p-4 rounded-xl border border-indigo-500/20">
                  <h4 className="text-xs font-bold uppercase text-indigo-400/70 mb-2 flex items-center gap-2">
                    <Sparkles size={12} /> Dica Pro
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Use tags como [INSTRUCT] para dar ordens diretas de formatação.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
