'use client';

import { useState, useEffect, useCallback } from 'react';
import { Brain, Search, Trash2, Tag, Loader2, AlertCircle } from 'lucide-react';

export function MemoriesView() {
  const [memories, setMemories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchMemories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = searchTerm
        ? `/api/memories?search=${encodeURIComponent(searchTerm)}`
        : '/api/memories';

      const res = await fetch(url);

      if (!res.ok) {
        if (res.status === 401) {
          setError('Você precisa estar autenticado para ver suas memórias.');
        } else {
          setError('Erro ao carregar memórias. Tente novamente.');
        }
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      setMemories(data);
    } catch (err) {
      console.error('Erro inesperado:', err);
      setError('Erro inesperado ao carregar memórias.');
    }

    setIsLoading(false);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMemories();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchMemories]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/memories?id=${id}`, { method: 'DELETE' });

      if (res.ok) {
        setMemories(memories.filter(m => m.mem_id !== id));
      } else {
        console.error('Erro ao deletar memória');
      }
    } catch (err) {
      console.error('Erro ao deletar memória:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      <div className="p-6 pb-4 shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
              <Brain className="text-indigo-400" />
              Memória Permanente
            </h2>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                type="text"
                placeholder="Buscar memórias..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500 w-64"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-4xl mx-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
              <AlertCircle className="text-red-400 shrink-0" size={20} />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-indigo-400" size={32} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {memories.map((mem) => (
                <div key={mem.mem_id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all flex flex-col gap-3 group relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag size={12} className="text-indigo-400" />
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                        {mem.mem_fonte || 'Sistema'}
                      </span>
                    </div>
                    {mem.mem_relevancia && (
                      <span className="text-[10px] text-zinc-600">
                        Relevância: {mem.mem_relevancia}/10
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-200 text-sm leading-relaxed">{mem.mem_conteudo}</p>
                  <p className="text-[10px] text-zinc-600 mt-2">
                    {formatDate(mem.mem_criado_em)}
                  </p>

                  <button
                    onClick={() => handleDelete(mem.mem_id)}
                    className="absolute top-4 right-4 p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {memories.length === 0 && !error && (
                <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl w-full col-span-full">
                  <Brain size={40} className="mx-auto text-zinc-700 mb-4" />
                  <p className="text-zinc-500">Nenhuma memória extraída ainda.</p>
                  <p className="text-sm text-zinc-600 mt-1">Converse com o Cuca AI para ele aprender sobre você.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}