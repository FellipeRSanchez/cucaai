'use client';

import { useState, useEffect, useCallback } from 'react';
import { Folder, Trash2, Plus, Pencil, X, Check, ChevronDown, ChevronRight, MessageCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useChatStore, Project } from '@/store/chatStore';
import clsx from 'clsx';

export function ProjectsView() {
  const { projects, fetchProjects, createProject, updateProject, deleteProject, conversations } = useChatStore();
  const [isLoading, setIsLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editCor, setEditCor] = useState('');

  useEffect(() => {
    fetchProjects().then(() => setIsLoading(false));
  }, [fetchProjects]);

  const conversationCount = (projectId: string) =>
    conversations.filter(c => c.con_projeto_id === projectId).length;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createProject({ nome: newName.trim(), descricao: newDesc.trim(), system_prompt: newPrompt.trim() });
    setNewName('');
    setNewDesc('');
    setNewPrompt('');
    setShowNewForm(false);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setEditName(project.pro_nome);
    setEditDesc(project.pro_descricao || '');
    setEditPrompt(project.pro_system_prompt || '');
    setEditEmoji(project.pro_emoji);
    setEditCor(project.pro_cor);
  };

  const handleSaveEdit = async () => {
    if (!editingProject || !editName.trim()) return;
    await updateProject(editingProject.pro_id, {
      nome: editName.trim(),
      descricao: editDesc.trim() || '',
      system_prompt: editPrompt.trim() || '',
      emoji: editEmoji,
      cor: editCor,
    });
    setEditingProject(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Excluir este projeto? As conversas serão movidas para "Geral".')) {
      await deleteProject(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6 bg-zinc-950 overflow-y-auto flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 bg-zinc-950 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Folder className="text-indigo-400" />
            Projetos
          </h2>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
          >
            <Plus size={16} />
            Novo Projeto
          </button>
        </div>

        {/* New Project Form */}
        {showNewForm && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6 space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do projeto"
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Descrição (opcional)"
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="System prompt do projeto (opcional) — será injetado em todos os chats deste projeto"
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewForm(false)} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
              <button onClick={handleCreate} className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">Criar</button>
            </div>
          </div>
        )}

        {/* Project List */}
        <div className="grid gap-4">
          {projects.map((project) => (
            <div key={project.pro_id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 group hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: project.pro_cor + '20' }}
                  >
                    {project.pro_emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-zinc-200 font-medium">{project.pro_nome}</h3>
                    {project.pro_descricao && (
                      <p className="text-xs text-zinc-500 mt-0.5">{project.pro_descricao}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <MessageCircle size={12} />
                        {conversationCount(project.pro_id)} conversas
                      </span>
                      {project.pro_system_prompt && (
                        <span className="text-xs text-indigo-400">Contexto personalizado</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <button
                    onClick={() => handleEdit(project)}
                    className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-all"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(project.pro_id)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {projects.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl">
              <Folder size={40} className="mx-auto text-zinc-700 mb-4" />
              <p className="text-zinc-500">Nenhum projeto criado.</p>
              <p className="text-sm text-zinc-600 mt-1">Crie projetos para agrupar conversas e compartilhar contexto.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditingProject(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="text-lg font-semibold text-zinc-100">Editar Projeto</h3>
              <button onClick={() => setEditingProject(null)} className="text-zinc-400 hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Descrição</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Emoji</label>
                  <input
                    type="text"
                    value={editEmoji}
                    onChange={(e) => setEditEmoji(e.target.value)}
                    className="w-20 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Cor</label>
                  <input
                    type="color"
                    value={editCor}
                    onChange={(e) => setEditCor(e.target.value)}
                    className="w-12 h-9 bg-zinc-800 border border-zinc-700 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  System Prompt do Projeto
                  <span className="text-zinc-600 ml-1">(injetado em todos os chats do projeto)</span>
                </label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  rows={6}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-800">
              <button onClick={() => setEditingProject(null)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
              <button onClick={handleSaveEdit} className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">
                <Check size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
