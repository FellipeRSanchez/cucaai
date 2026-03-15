-- ============================================
-- FIX COMPLETO: RECREAR TABELAS COM ESTRUTURA CORRETA
-- ============================================
-- Execute no Supabase SQL Editor
-- Baseado nos campos que o código realmente usa

-- ============================================
-- 1. MEMORIAS - Recriar com estrutura do código
-- ============================================
-- O código usa: mem_conteudo, mem_embedding, mem_tipo, mem_importancia, mem_origem
-- E PRECISA de: mem_usuario_id

DROP TABLE IF EXISTS cuca.memorias CASCADE;

CREATE TABLE cuca.memorias (
  mem_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mem_usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- Nullable para permitir memory manager
  mem_conteudo TEXT NOT NULL,
  mem_embedding vector(1536),
  mem_tipo TEXT DEFAULT 'LTM',
  mem_importancia DECIMAL(3,2) DEFAULT 0.8,
  mem_origem TEXT,
  mem_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Permissões
GRANT ALL ON cuca.memorias TO service_role;
GRANT ALL ON cuca.memorias TO authenticated;

-- RLS
ALTER TABLE cuca.memorias ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'memorias' AND policyname = 'Usuários podem ver suas próprias memórias') THEN
    CREATE POLICY "Usuários podem ver suas próprias memórias" ON cuca.memorias FOR SELECT USING (auth.uid() = mem_usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'memorias' AND policyname = 'Service role pode inserir') THEN
    CREATE POLICY "Service role pode inserir" ON cuca.memorias FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_memorias_usuario ON cuca.memorias(mem_usuario_id);
CREATE INDEX IF NOT EXISTS idx_memorias_tipo ON cuca.memorias(mem_tipo);

-- ============================================
-- 2. DOCUMENTOS - Verificar se tem embedding
-- ============================================
-- O código usa: doc_embedding para busca semântica

ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_embedding vector(1536);

-- ============================================
-- 3. CACHE_SEMANTICO - Verificar estrutura
-- ============================================
-- O código usa: cache_pergunta, cache_resposta, cache_modelo, cache_embedding

DROP TABLE IF EXISTS cuca.cache_semantico CASCADE;

CREATE TABLE cuca.cache_semantico (
  cache_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_pergunta TEXT NOT NULL,
  cache_resposta TEXT NOT NULL,
  cache_modelo TEXT NOT NULL,
  cache_embedding vector(1536),
  cache_contador INTEGER DEFAULT 1,
  cache_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  cache_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

GRANT ALL ON cuca.cache_semantico TO service_role;
GRANT ALL ON cuca.cache_semantico TO authenticated;

ALTER TABLE cuca.cache_semantico ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'cache_semantico' AND policyname = 'Cache access') THEN
    CREATE POLICY "Cache access" ON cuca.cache_semantico FOR ALL USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cache_criado ON cuca.cache_semantico(cache_criado_em DESC);

-- ============================================
-- 4. GRAFO_ENTIDADES e GRAFO_RELACOES
-- ============================================

DROP TABLE IF EXISTS cuca.grafo_relacoes CASCADE;
DROP TABLE IF EXISTS cuca.grafo_entidades CASCADE;

CREATE TABLE cuca.grafo_entidades (
  ent_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ent_nome TEXT NOT NULL,
  ent_tipo TEXT NOT NULL,
  ent_metadados JSONB,
  ent_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(ent_nome, ent_tipo)
);

CREATE TABLE cuca.grafo_relacoes (
  rel_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rel_entidade_origem UUID NOT NULL REFERENCES cuca.grafo_entidades(ent_id) ON DELETE CASCADE,
  rel_entidade_destino UUID NOT NULL REFERENCES cuca.grafo_entidades(ent_id) ON DELETE CASCADE,
  rel_tipo TEXT NOT NULL,
  rel_descricao TEXT,
  rel_força INTEGER DEFAULT 1 CHECK (rel_força >= 1 AND rel_força <= 10),
  rel_metadados JSONB,
  rel_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(rel_entidade_origem, rel_entidade_destino, rel_tipo)
);

GRANT ALL ON cuca.grafo_entidades TO service_role;
GRANT ALL ON cuca.grafo_entidades TO authenticated;
GRANT ALL ON cuca.grafo_relacoes TO service_role;
GRANT ALL ON cuca.grafo_relacoes TO authenticated;

ALTER TABLE cuca.grafo_entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.grafo_relacoes ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'grafo_entidades' AND policyname = 'Graph entities access') THEN
    CREATE POLICY "Graph entities access" ON cuca.grafo_entidades FOR ALL USING (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'grafo_relacoes' AND policyname = 'Graph relations access') THEN
    CREATE POLICY "Graph relations access" ON cuca.grafo_relacoes FOR ALL USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_entidades_tipo ON cuca.grafo_entidades(ent_tipo);
CREATE INDEX IF NOT EXISTS idx_entidades_nome ON cuca.grafo_entidades(ent_nome);
CREATE INDEX IF NOT EXISTS idx_relacoes_origem ON cuca.grafo_relacoes(rel_entidade_origem);
CREATE INDEX IF NOT EXISTS idx_relacoes_destino ON cuca.grafo_relacoes(rel_entidade_destino);

-- ============================================
-- PRONTO!
-- Agora todas as tabelas têm a estrutura correta
-- ============================================