'use client';

import { MessageCircle, Brain, Database, PlusCircle, Settings, UserCircle, Trash2, History, X, Folder, ChevronRight, ChevronDown, FolderPlus, Pencil, MoreHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { useUIStore, ViewType } from '@/store/uiStore';
import { useChatStore, Project } from '@/store/chatStore';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function Sidebar() {
  const { activeView, setActiveView, isMobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const {
    conversations, fetchConversations, currentConversationId, fetchMessages, resetChat,
    deleteConversation, projects, fetchProjects, createProject, updateProject, deleteProject,
    setCurrentProjectId, currentProjectId
  } = useChatStore();
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [showProjectMenu, setShowProjectMenu] = useState<string | null>(null);

  useEffect(() => {
    fetchConversations();
    fetchProjects();

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
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
  }, [fetchConversations, fetchProjects]);

  // Auto-expand project with current conversation
  useEffect(() => {
    if (currentConversationId) {
      const conv = conversations.find(c => c.con_id === currentConversationId);
      if (conv?.con_projeto_id) {
        setExpandedProjects(prev => new Set(prev).add(conv.con_projeto_id!));
      }
    }
  }, [currentConversationId, conversations]);

  const handleNewChat = () => {
    resetChat();
    setActiveView('CHAT');
  };

  const handleSelectConversation = (id: string) => {
    fetchMessages(id);
    const conv = conversations.find(c => c.con_id === id);
    if (conv?.con_projeto_id) {
      setCurrentProjectId(conv.con_projeto_id);
    }
    setActiveView('CHAT');
    setMobileMenuOpen(false);
  };

  const handleProjectClick = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const project = await createProject({ nome: newProjectName.trim() });
    if (project) {
      setExpandedProjects(prev => new Set(prev).add(project.pro_id));
    }
    setNewProjectName('');
    setShowNewProjectInput(false);
  };

  const handleRenameProject = async (id: string) => {
    if (!editingProjectName.trim()) return;
    await updateProject(id, { nome: editingProjectName.trim() });
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm('Excluir este projeto? As conversas serão movidas para "Geral".')) {
      await deleteProject(id);
    }
    setShowProjectMenu(null);
  };

  const conversationsInProject = (projectId: string) =>
    conversations.filter(c => c.con_projeto_id === projectId);

  const conversationsWithoutProject = () =>
    conversations.filter(c => !c.con_projeto_id);

  return (
    <>
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

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
              icon={<Folder size={18} />}
              label="Projetos"
              active={activeView === 'PROJECTS'}
              onClick={() => setActiveView('PROJECTS')}
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

          {/* Projects Section */}
          <div className="px-4 py-2 mt-1">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <Folder size={10} /> Projetos
              </h2>
              <button
                onClick={() => setShowNewProjectInput(true)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
                title="Novo projeto"
              >
                <FolderPlus size={14} />
              </button>
            </div>
            {showNewProjectInput && (
              <div className="mt-2 flex items-center gap-1">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onBlur={handleCreateProject}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); if (e.key === 'Escape') { setShowNewProjectInput(false); setNewProjectName(''); } }}
                  className="flex-1 bg-zinc-800 border border-indigo-500/50 text-zinc-100 text-xs rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Nome do projeto"
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {/* Project groups */}
            {projects.map((project) => {
              const projectConversations = conversationsInProject(project.pro_id);
              const isExpanded = expandedProjects.has(project.pro_id);
              const isActive = currentProjectId === project.pro_id;

              return (
                <div key={project.pro_id} className="space-y-0.5">
                  <div
                    className={clsx(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer group",
                      isActive
                        ? "bg-indigo-900/20 text-indigo-300 border border-indigo-500/30"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    )}
                    onClick={() => { setCurrentProjectId(project.pro_id); setActiveView('CHAT'); }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); handleProjectClick(project.pro_id); }}
                      className="p-0.5 hover:text-zinc-200"
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    <span className="shrink-0">{project.pro_emoji}</span>

                    {editingProjectId === project.pro_id ? (
                      <input
                        type="text"
                        value={editingProjectName}
                        onChange={(e) => setEditingProjectName(e.target.value)}
                        onBlur={() => handleRenameProject(project.pro_id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameProject(project.pro_id); if (e.key === 'Escape') setEditingProjectId(null); }}
                        className="flex-1 bg-zinc-800 border border-indigo-500/50 text-zinc-100 text-xs rounded px-1.5 py-0.5 outline-none"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flex-1 truncate">{project.pro_nome}</span>
                    )}

                    <span className="text-[10px] text-zinc-600">{projectConversations.length}</span>

                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowProjectMenu(showProjectMenu === project.pro_id ? null : project.pro_id); }}
                        className="p-0.5 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <MoreHorizontal size={12} />
                      </button>
                      {showProjectMenu === project.pro_id && (
                        <div className="absolute left-0 top-full mt-1 w-32 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-1">
                          <button
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                            onClick={(e) => { e.stopPropagation(); setEditingProjectId(project.pro_id); setEditingProjectName(project.pro_nome); setShowProjectMenu(null); }}
                          >
                            <Pencil size={12} /> Renomear
                          </button>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-700"
                            onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.pro_id); }}
                          >
                            <Trash2 size={12} /> Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Project conversations */}
                  {isExpanded && projectConversations.length > 0 && (
                    <div className="ml-4 border-l border-zinc-800 pl-2 space-y-0.5">
                      {projectConversations.map((conv) => (
                        <ConversationItem
                          key={conv.con_id}
                          conv={conv}
                          isActive={currentConversationId === conv.con_id}
                          onSelect={() => handleSelectConversation(conv.con_id)}
                          onDelete={() => deleteConversation(conv.con_id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* General (no project) conversations */}
            <div className="mt-3">
              <div className="flex items-center gap-2 px-2 py-1">
                <History size={10} className="text-zinc-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Geral</span>
              </div>
              {conversationsWithoutProject().length === 0 ? (
                <div className="px-4 py-3 text-xs text-zinc-600 italic">Nenhuma conversa recente</div>
              ) : (
                conversationsWithoutProject().map((conv) => (
                  <ConversationItem
                    key={conv.con_id}
                    conv={conv}
                    isActive={currentConversationId === conv.con_id}
                    onSelect={() => handleSelectConversation(conv.con_id)}
                    onDelete={() => deleteConversation(conv.con_id)}
                  />
                ))
              )}
            </div>
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

function ConversationItem({ conv, isActive, onSelect, onDelete }: {
  conv: { con_id: string; con_titulo: string };
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onSelect}
        className={clsx(
          "flex w-full items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all text-left truncate pr-10",
          isActive
            ? "bg-indigo-900/20 text-indigo-300 font-medium border border-indigo-500/30"
            : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
        )}
      >
        <MessageCircle size={14} className={isActive ? "text-indigo-400" : "text-zinc-500"} />
        <span className="truncate">{conv.con_titulo}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-red-500/10"
      >
        <Trash2 size={12} />
      </button>
    </div>
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
