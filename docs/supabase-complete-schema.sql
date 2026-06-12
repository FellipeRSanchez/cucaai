-- ============================================
-- SCHEMA CUCA - COMPLETE SETUP
-- ============================================
-- Execute este arquivo no Supabase SQL Editor
-- para criar todas as tabelas necessárias com as
-- colunas corretas e políticas RLS

-- Criar schema se não existir
CREATE SCHEMA IF NOT EXISTS cuca;

-- ============================================
-- TABELA: conversas
-- ============================================
CREATE TABLE IF NOT EXISTS cuca.conversas (
  con_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  con_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  con_titulo TEXT NOT NULL,
  con_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  con_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- TABELA: mensagens
-- ============================================
CREATE TABLE IF NOT EXISTS cuca.mensagens (
  men_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  men_conversa_id UUID NOT NULL REFERENCES cuca.conversas(con_id) ON DELETE CASCADE,
  men_papel TEXT NOT NULL CHECK (men_papel IN ('user', 'assistant')),
  men_conteudo TEXT NOT NULL,
  men_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- TABELA: documentos
-- ============================================
CREATE TABLE IF NOT EXISTS cuca.documentos (
  doc_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_nome TEXT NOT NULL,
  doc_tipo TEXT NOT NULL,
  doc_tamanho INTEGER,
  doc_conteudo TEXT, -- texto extraído (para embeddings)
  doc_embedding vector(1536), -- para pgvector
  doc_metadados JSONB,
  doc_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  doc_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- TABELA: documentos_chunks
-- ============================================
CREATE TABLE IF NOT EXISTS cuca.documentos_chunks (
  dch_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dch_documento UUID NOT NULL REFERENCES cuca.documentos(doc_id) ON DELETE CASCADE,
  dch_texto TEXT NOT NULL,
  dch_embedding vector(1536),
  dch_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- TABELA: memorias
-- ============================================
CREATE TABLE IF NOT EXISTS cuca.memorias (
  mem_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mem_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mem_conteudo TEXT NOT NULL,
  mem_relevancia INTEGER CHECK (mem_relevancia >= 1 AND mem_relevancia <= 10),
  mem_fonte TEXT, -- 'user', 'agent', 'document'
  mem_metadados JSONB,
  mem_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  mem_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- TABELA: cache_semantico
-- ============================================
CREATE TABLE IF NOT EXISTS cuca.cache_semantico (
  cache_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_pergunta TEXT NOT NULL,
  cache_resposta TEXT NOT NULL,
  cache_modelo TEXT NOT NULL,
  cache_embedding vector(1536), -- para busca por similaridade
  cache_contador INTEGER DEFAULT 1,
  cache_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  cache_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- TABELA: grafo_entidades
-- ============================================
CREATE TABLE IF NOT EXISTS cuca.grafo_entidades (
  ent_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ent_nome TEXT NOT NULL,
  ent_tipo TEXT NOT NULL, -- 'pessoa', 'organizacao', 'local', 'conceito', etc.
  ent_metadados JSONB,
  ent_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(ent_nome, ent_tipo) -- Evita duplicatas
);

-- ============================================
-- TABELA: grafo_relacoes
-- ============================================
CREATE TABLE IF NOT EXISTS cuca.grafo_relacoes (
  rel_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rel_entidade_origem UUID NOT NULL REFERENCES cuca.grafo_entidades(ent_id) ON DELETE CASCADE,
  rel_entidade_destino UUID NOT NULL REFERENCES cuca.grafo_entidades(ent_id) ON DELETE CASCADE,
  rel_tipo TEXT NOT NULL, -- 'work_at', 'knows', 'located_in', etc.
  rel_descricao TEXT,
  rel_força INTEGER DEFAULT 1 CHECK (rel_força >= 1 AND rel_força <= 10),
  rel_metadados JSONB,
  rel_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(rel_entidade_origem, rel_entidade_destino, rel_tipo) -- Evita duplicatas
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

-- Conversas
CREATE INDEX IF NOT EXISTS idx_conversas_usuario ON cuca.conversas(con_usuario_id);
CREATE INDEX IF NOT EXISTS idx_conversas_atualizado ON cuca.conversas(con_atualizado_em DESC);

-- Mensagens
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON cuca.mensagens(men_conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_criado ON cuca.mensagens(men_criado_em ASC);

-- Documentos
CREATE INDEX IF NOT EXISTS idx_documentos_usuario ON cuca.documentos(doc_usuario_id);
CREATE INDEX IF NOT EXISTS idx_documentos_criado ON cuca.documentos(doc_criado_em DESC);

-- Documentos Chunks
CREATE INDEX IF NOT EXISTS idx_chunks_documento ON cuca.documentos_chunks(dch_documento);

-- Memórias
CREATE INDEX IF NOT EXISTS idx_memorias_usuario ON cuca.memorias(mem_usuario_id);
CREATE INDEX IF NOT EXISTS idx_memorias_relevancia ON cuca.memorias(mem_relevancia DESC);

-- Cache Semântico
CREATE INDEX IF NOT EXISTS idx_cache_criado ON cuca.cache_semantico(cache_criado_em DESC);

-- Grafo de Entidades
CREATE INDEX IF NOT EXISTS idx_entidades_tipo ON cuca.grafo_entidades(ent_tipo);
CREATE INDEX IF NOT EXISTS idx_entidades_nome ON cuca.grafo_entidades(ent_nome);

-- Grafo de Relações
CREATE INDEX IF NOT EXISTS idx_relacoes_origem ON cuca.grafo_relacoes(rel_entidade_origem);
CREATE INDEX IF NOT EXISTS idx_relacoes_destino ON cuca.grafo_relacoes(rel_entidade_destino);

-- ============================================
-- HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE cuca.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.memorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.cache_semantico ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.grafo_entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.grafo_relacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.documentos_chunks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS: conversas
-- ============================================
CREATE POLICY "Usuários podem ver suas próprias conversas"
  ON cuca.conversas FOR SELECT
  USING (auth.uid() = con_usuario_id);

CREATE POLICY "Usuários podem criar suas próprias conversas"
  ON cuca.conversas FOR INSERT
  WITH CHECK (auth.uid() = con_usuario_id);

CREATE POLICY "Usuários podem atualizar suas próprias conversas"
  ON cuca.conversas FOR UPDATE
  USING (auth.uid() = con_usuario_id)
  WITH CHECK (auth.uid() = con_usuario_id);

CREATE POLICY "Usuários podem deletar suas próprias conversas"
  ON cuca.conversas FOR DELETE
  USING (auth.uid() = con_usuario_id);

-- ============================================
-- POLÍTICAS RLS: mensagens
-- ============================================
CREATE POLICY "Usuários podem ver mensagens de suas conversas"
  ON cuca.mensagens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cuca.conversas
      WHERE con_id = mensagens.men_conversa_id
      AND con_usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar mensagens em suas conversas"
  ON cuca.mensagens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cuca.conversas
      WHERE con_id = mensagens.men_conversa_id
      AND con_usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar mensagens em suas conversas"
  ON cuca.mensagens FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cuca.conversas
      WHERE con_id = mensagens.men_conversa_id
      AND con_usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar mensagens em suas conversas"
  ON cuca.mensagens FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cuca.conversas
      WHERE con_id = mensagens.men_conversa_id
      AND con_usuario_id = auth.uid()
    )
  );

-- ============================================
-- POLÍTICAS RLS: documentos
-- ============================================
CREATE POLICY "Usuários podem ver seus próprios documentos"
  ON cuca.documentos FOR SELECT
  USING (auth.uid() = doc_usuario_id);

CREATE POLICY "Usuários podem criar seus próprios documentos"
  ON cuca.documentos FOR INSERT
  WITH CHECK (auth.uid() = doc_usuario_id);

CREATE POLICY "Usuários podem atualizar seus próprios documentos"
  ON cuca.documentos FOR UPDATE
  USING (auth.uid() = doc_usuario_id)
  WITH CHECK (auth.uid() = doc_usuario_id);

CREATE POLICY "Usuários podem deletar seus próprios documentos"
  ON cuca.documentos FOR DELETE
  USING (auth.uid() = doc_usuario_id);

-- ============================================
-- POLÍTICAS RLS: memorias
-- ============================================
CREATE POLICY "Usuários podem ver suas próprias memórias"
  ON cuca.memorias FOR SELECT
  USING (auth.uid() = mem_usuario_id);

CREATE POLICY "Usuários podem criar suas próprias memórias"
  ON cuca.memorias FOR INSERT
  WITH CHECK (auth.uid() = mem_usuario_id);

CREATE POLICY "Usuários podem atualizar suas próprias memórias"
  ON cuca.memorias FOR UPDATE
  USING (auth.uid() = mem_usuario_id)
  WITH CHECK (auth.uid() = mem_usuario_id);

CREATE POLICY "Usuários podem deletar suas próprias memórias"
  ON cuca.memorias FOR DELETE
  USING (auth.uid() = mem_usuario_id);

-- ============================================
-- POLÍTICAS RLS: cache_semantico
-- ============================================
CREATE POLICY "Usuários podem ver seu próprio cache"
  ON cuca.cache_semantico FOR SELECT
  USING (true); -- Cache pode ser lido por todos (opcional, ajuste conforme necessidade)

CREATE POLICY "Usuários podem criar seu próprio cache"
  ON cuca.cache_semantico FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar seu próprio cache"
  ON cuca.cache_semantico FOR UPDATE
  USING (true);

-- ============================================
-- POLÍTICAS RLS: grafo_entidades
-- ============================================
CREATE POLICY "Usuários podem ver todas as entidades"
  ON cuca.grafo_entidades FOR SELECT
  USING (true); -- Grafo é compartilhado entre todos os usuários

CREATE POLICY "Usuários podem criar entidades"
  ON cuca.grafo_entidades FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar entidades"
  ON cuca.grafo_entidades FOR UPDATE
  USING (true);

CREATE POLICY "Usuários podem deletar entidades"
  ON cuca.grafo_entidades FOR DELETE
  USING (true);

-- ============================================
-- POLÍTICAS RLS: grafo_relacoes
-- ============================================
CREATE POLICY "Usuários podem ver todas as relações"
  ON cuca.grafo_relacoes FOR SELECT
  USING (true);

CREATE POLICY "Usuários podem criar relações"
  ON cuca.grafo_relacoes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar relações"
  ON cuca.grafo_relacoes FOR UPDATE
  USING (true);

CREATE POLICY "Usuários podem deletar relações"
  ON cuca.grafo_relacoes FOR DELETE
  USING (true);

-- ============================================
-- POLÍTICAS RLS: documentos_chunks
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

-- ============================================
-- EXTENSÃO NECESSÁRIA (pgvector)
-- ============================================
-- IMPORTANTE: Execute separadamente se ainda não existir:
-- CREATE EXTENSION IF NOT EXISTS vector;