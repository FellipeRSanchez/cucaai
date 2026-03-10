'use client';

import { useModelsStore } from '@/store/modelsStore';
import { useEffect, useRef, useState } from 'react';
import { Bot, Paperclip, Globe, Wrench, ChevronDown, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

import { AGENT_PROFILES, AgentRole } from '@/lib/agents';
import { useUIStore } from '@/store/uiStore';

export function Header() {
  const { models, fetchModels, selectedModel, setSelectedModel, selectedAgent, setSelectedAgent, isLoading } = useModelsStore();
  const { webSearchEnabled, setWebSearchEnabled } = useUIStore();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        alert('Documento enviado com sucesso!');
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Erro ao enviar documento.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 shrink-0 shadow-sm z-10 w-full relative">
      <div className="flex items-center gap-4">
        {/* Model Selector */}
        <div className="relative group">
          <select 
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="appearance-none bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-md px-3 py-1.5 pr-8 hover:border-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors max-w-[200px] truncate shadow-sm cursor-pointer"
            disabled={isLoading}
          >
            <option value="openai/chatgpt-4o-latest">GPT-4o</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.id.split('/')[1]}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-2 text-zinc-400 pointer-events-none" size={14} />
        </div>

        {/* Agent Selector */}
        <div className="relative group hidden sm:block">
          <select 
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value as AgentRole)}
            className="appearance-none flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded-md px-3 py-1.5 pl-8 hover:border-zinc-700 outline-none focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer shadow-sm w-[160px]"
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
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept=".pdf,.docx,.txt"
        />
        
        <HeaderAction 
          icon={isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />} 
          tooltip="Upload" 
          onClick={handleUploadClick}
          disabled={isUploading}
        />
        <HeaderAction 
          icon={<Globe size={18} />} 
          tooltip="Busca Web" 
          active={webSearchEnabled}
          onClick={() => setWebSearchEnabled(!webSearchEnabled)}
        />
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

import clsx from 'clsx';
