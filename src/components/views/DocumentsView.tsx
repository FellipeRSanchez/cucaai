'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Trash2, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function DocumentsView() {
  const [docs, setDocs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .schema('cuca')
      .from('documentos')
      .select('*')
      .order('doc_criado_em', { ascending: false });

    if (!error && data) {
      setDocs(data);
    }
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .schema('cuca')
      .from('documentos')
      .delete()
      .eq('doc_id', id);

    if (!error) {
      setDocs(docs.filter(d => d.doc_id !== id));
    } else {
      alert('Erro ao excluir documento.');
    }
  };

  return (
    <div className="flex-1 p-6 bg-zinc-950 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-zinc-100 mb-6 flex items-center gap-2">
          <FileText className="text-indigo-400" />
          Seus Documentos
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-indigo-400" size={32} />
          </div>
        ) : (
          <div className="grid gap-4">
            {docs.map((doc) => (
              <div key={doc.doc_id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <FileText size={20} className="text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="text-zinc-200 font-medium">{doc.doc_nome}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(doc.doc_criado_em).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="text-xs text-indigo-400 flex items-center gap-1">
                        <CheckCircle size={12} />
                        Processado
                      </span>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleDelete(doc.doc_id)}
                  className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            
            {docs.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl">
                <FileText size={40} className="mx-auto text-zinc-700 mb-4" />
                <p className="text-zinc-500">Nenhum documento encontrado.</p>
                <p className="text-sm text-zinc-600 mt-1">Use o botão de clipe no chat para fazer upload.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
