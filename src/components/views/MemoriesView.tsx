'use client';

import { useState, useEffect, useCallback } from 'react';
import { Brain, Search, Trash2, Tag, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function MemoriesView() {
  const [memories, setMemories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMemories = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .schema('cuca')
      .from('memorias')
      .select('*')
      .order('mem_criado_em', { ascending: false });

    if (searchTerm) {
      query = query.ilike('mem_conteudo', `%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (!error && data) {
      setMemories(data);
    }
    setIsLoading(false);
  }, [supabase, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMemories();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchMemories]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .schema('cuca')
      .from('memorias')
      .delete()
      .eq('mem_id', id);

    if (!error) {
      setMemories(memories.filter(m => m.mem_id !== id));
    }
  };

  return (
    <div className="flex-1 p-6 bg-zinc-950 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
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

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-indigo-400" size={32} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memories.map((mem) => (
              <div key={mem.mem_id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all flex flex-col gap-3 group relative">
                <div className="flex items-center gap-2">
                  <Tag size={12} className="text-indigo-400" />
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{mem.mem_tipo}</span>
                </div>
                <p className="text-zinc-200 text-sm leading-relaxed">{mem.mem_conteudo}</p>
                
                <button 
                  onClick={() => handleDelete(mem.mem_id)}
                  className="absolute top-4 right-4 p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            
            {memories.length === 0 && (
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
  );
}
