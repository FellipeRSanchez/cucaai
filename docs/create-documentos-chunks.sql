-- ============================================
-- TABELA: documentos_chunks
-- ============================================
-- Esta tabela armazena os fragmentos de texto dos documentos
-- com seus respectivos embeddings para busca vetorial (RAG).

CREATE TABLE IF NOT EXISTS cuca.documentos_chunks (
  dch_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dch_documento UUID NOT NULL REFERENCES cuca.documentos(doc_id) ON DELETE CASCADE,
  dch_texto TEXT NOT NULL,
  dch_embedding vector(1536), -- Compatível com openai/text-embedding-3-small
  dch_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_chunks_documento ON cuca.documentos_chunks(dch_documento);

-- Índice HNSW para busca vetorial (requer pgvector)
-- Opcional: descomente se tiver muitos dados e quiser busca aproximada mais rápida
-- CREATE INDEX ON cuca.documentos_chunks USING hnsw (dch_embedding vector_cosine_ops);

-- ============================================
-- HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE cuca.documentos_chunks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS
-- ============================================
CREATE POLICY "Usuários podem ver chunks de seus documentos"
  ON cuca.documentos_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cuca.documentos d
      WHERE d.doc_id = documentos_chunks.dch_documento
      AND d.doc_usuario_id = auth.uid()
    )
  );

-- O insert via service role (admin) ignora RLS, por isso não precisamos de política de INSERT/UPDATE 
-- se o upload for feito via service_role_key no backend.
