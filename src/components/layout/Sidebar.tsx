'use client';

import { MessageCircle, Brain, Database, Network, Search, PlusCircle, Settings, UserCircle, Menu, Trash2, History, X } from 'lucide-react';
import clsx from 'clsx';
import { useUIStore, ViewType } from '@/store/uiStore';
import { useChatStore } from '@/store/chatStore';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function Sidebar() {
  const { activeView, setActiveView, isMobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const { conversations, fetchConversations, currentConversationId, fetchMessages, resetChat, deleteConversation } = useChatStore();
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);

  useEffect(() => {
    fetchConversations();

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Buscar nome da tabela usuarios
        const { data: userData } = await supabase
          .from('usuarios')
          .select('usu_nome')
          .eq('usu_id', user.id)
          .single();

        setUser({
          email: user.email,
          name: userData?.usu_nome || user.user_metadata?.full_name || user.email?.split('@')[0]
        });
      }
    };
    getUser();
  }, [fetchConversations]);

  const handleNewChat = () => {
    resetChat();
    setActiveView('CHAT');
  };

  const handleSelectConversation = (id: string) => {
    fetchMessages(id);
    setActiveView('CHAT');
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        "w-64 h-full bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0 z-50",
        "md:relative md:translate-x-0",
        isMobileMenuOpen
          ? "fixed inset-y-0 left-0 translate-x-0"
          : "fixed inset-y-0 left-0 -translate-x-full md:translate-x-0"
      )}>
        <div className="p-4 flex items-center justify-between border-b border-zinc-800">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              setActiveView('CHAT');
              setMobileMenuOpen(false);
            }}
          >
            <img src="/cuca_logo.png" alt="Cuca AI Logo" className="h-8 w-auto" />
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Cuca AI
            </span>
          </div>
          <button
            className="text-zinc-400 hover:text-zinc-100 transition-colors md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg font-medium transition-all shadow-md shadow-indigo-900/20 active:scale-95"
          >
            <PlusCircle size={18} />
            Novo Chat
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <nav className="p-3 space-y-1">
            <NavItem
              icon={<MessageCircle size={18} />}
              label="Conversar"
              active={activeView === 'CHAT' && !currentConversationId}
              onClick={() => setActiveView('CHAT')}
            />
            <NavItem
              icon={<UserCircle size={18} />}
              label="Agentes"
              active={activeView === 'AGENTS'}
              onClick={() => setActiveView('AGENTS')}
            />
            <NavItem
              icon={<Database size={18} />}
              label="Documentos"
              active={activeView === 'DOCUMENTS'}
              onClick={() => setActiveView('DOCUMENTS')}
            />
            <NavItem
              icon={<Brain size={18} />}
              label="Memórias"
              active={activeView === 'MEMORIES'}
              onClick={() => setActiveView('MEMORIES')}
            />
          </nav>

          <div className="px-4 py-2 mt-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
              <History size={10} /> Histórico Recente
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {conversations.length === 0 ? (
              <div className="px-4 py-3 text-xs text-zinc-600 italic">Nenhuma conversa recente</div>
            ) : (
              conversations.map((conv) => (
                <div key={conv.con_id} className="group relative">
                  <button
                    onClick={() => handleSelectConversation(conv.con_id)}
                    className={clsx(
                      "flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all text-left truncate pr-10",
                      currentConversationId === conv.con_id
                        ? "bg-indigo-900/20 text-indigo-300 font-medium border border-indigo-500/30"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    )}
                  >
                    <MessageCircle size={14} className={currentConversationId === conv.con_id ? "text-indigo-400" : "text-zinc-500"} />
                    <span className="truncate">{conv.con_titulo}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.con_id); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-red-500/10"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-lg border border-white/10">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-zinc-200 truncate">{user?.name || 'Usuário'}</p>
              <p className="text-[10px] text-zinc-500 truncate uppercase tracking-tight">{user?.email || 'pessoal@workspace.ai'}</p>
            </div>
            <button
              onClick={() => setActiveView('SETTINGS')}
              className={clsx(
                "p-2 rounded-md transition-all",
                activeView === 'SETTINGS' ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              )}
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
        active
          ? "bg-zinc-800 text-zinc-100 font-medium shadow-sm border border-zinc-700/50"
          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
      )}
    >
      <span className={clsx(active ? "text-indigo-400" : "text-zinc-500")}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}