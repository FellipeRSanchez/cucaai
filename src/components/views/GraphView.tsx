'use client';

import { useState, useEffect } from 'react';
import { Network, Circle, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function GraphView() {
  const [entities, setEntities] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const [entRes, relRes] = await Promise.all([
        supabase.schema('cuca').from('entidades').select('*').limit(50),
        supabase.schema('cuca').from('relacoes').select('*').limit(50)
      ]);

      if (entRes.data) setEntities(entRes.data);
      if (relRes.data) setRelations(relRes.data);
      setIsLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="flex-1 p-6 bg-zinc-950 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-zinc-100 mb-8 flex items-center gap-2">
          <Network className="text-indigo-400" />
          Knowledge Graph
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-indigo-400" size={32} />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Entities Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Circle size={8} className="fill-indigo-500 text-indigo-500" />
                Entidades
              </h3>
              <div className="space-y-2">
                {entities.map(ent => (
                  <div key={ent.ent_id} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-lg flex items-center justify-between">
                    <span className="text-zinc-200 font-medium">{ent.ent_nome}</span>
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded uppercase">{ent.ent_tipo}</span>
                  </div>
                ))}
                {entities.length === 0 && <p className="text-zinc-600 text-xs italic">Nenhuma entidade extraída.</p>}
              </div>
            </div>

            {/* Relations Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <ArrowRight size={12} className="text-indigo-400" />
                Relações
              </h3>
              <div className="space-y-2">
                {relations.map(rel => (
                  <div key={rel.rel_id} className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-lg flex items-center gap-3">
                    <span className="text-zinc-300 text-sm font-medium">{rel.rel_origem}</span>
                    <div className="flex-1 border-t border-dashed border-zinc-700 relative">
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] text-indigo-400 bg-zinc-950 px-1 italic">
                        {rel.rel_tipo}
                      </span>
                    </div>
                    <span className="text-zinc-300 text-sm font-medium">{rel.rel_destino}</span>
                  </div>
                ))}
                {relations.length === 0 && <p className="text-zinc-600 text-xs italic">Nenhuma relação extraída.</p>}
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-6 flex gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Network className="text-indigo-400" />
          </div>
          <div>
            <h4 className="text-zinc-100 font-semibold mb-1">Sobre o Grafo de Conhecimento</h4>
            <p className="text-sm text-zinc-500 leading-relaxed">
              O Cuca AI mapeia automaticamente conceitos e pessoas citados em suas conversas. 
              Isso ajuda o sistema a entender o contexto e navegar entre informações relacionadas de forma mais eficiente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
