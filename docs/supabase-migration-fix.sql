-- ============================================
-- MIGRAÇÃO SEGURA: CORRIGIR TABELAS EXISTENTES
-- ============================================
-- Este script adiciona colunas faltantes de forma idempotente
-- É seguro executar múltiplas vezes
-- Use este se o script anterior falhou

-- Criar schema se não existir
CREATE SCHEMA IF NOT EXISTS cuca;

-- ============================================
-- 1. CONVERSAS - Adicionar colunas faltantes
-- ============================================

-- Adiciona con_usuario_id se não existir (nullable inicialmente)
ALTER TABLE cuca.conversas ADD COLUMN IF NOT EXISTS con_usuario_id UUID;

-- Popula com um usuário válido (primeiro da tabela auth.users)
-- Se não houver usuários, ficará NULL (será corrigido depois)
UPDATE cuca.conversas 
SET con_usuario_id = (SELECT id FROM auth.users LIMIT 1) 
WHERE con_usuario_id IS NULL;

-- Tornar NOT NULL
ALTER TABLE cuca.conversas ALTER COLUMN con_usuario_id SET NOT NULL;

-- Adiciona outras colunas de timestamp se faltarem
ALTER TABLE cuca.conversas ADD COLUMN IF NOT EXISTS con_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
ALTER TABLE cuca.conversas ADD COLUMN IF NOT EXISTS con_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

-- Adiciona constraint de foreign key (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversas_con_usuario_id_fkey' 
    AND conrelid = 'cuca.conversas'::regclass
  ) THEN
    ALTER TABLE cuca.conversas 
      ADD CONSTRAINT conversas_con_usuario_id_fkey 
      FOREIGN KEY (con_usuario_id) 
      REFERENCES auth.users(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 2. MENSAGENS - Criar ou complementar
-- ============================================

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS cuca.mensagens (
  men_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  men_conversa_id UUID NOT NULL REFERENCES cuca.conversas(con_id) ON DELETE CASCADE,
  men_papel TEXT NOT NULL CHECK (men_papel IN ('user', 'assistant')),
  men_conteudo TEXT NOT NULL,
  men_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Adicionar colunas faltantes se a tabela já existe
ALTER TABLE cuca.mensagens ADD COLUMN IF NOT EXISTS men_conteudo TEXT NOT NULL DEFAULT '';
ALTER TABLE cuca.mensagens ADD COLUMN IF NOT EXISTS men_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
ALTER TABLE cuca.mensagens ADD COLUMN IF NOT EXISTS men_papel TEXT NOT NULL DEFAULT 'user';
ALTER TABLE cuca.mensagens ADD COLUMN IF NOT EXISTS men_conversa_id UUID REFERENCES cuca.conversas(con_id);

-- ============================================
-- 3. DOCUMENTOS - Criar ou complementar
-- ============================================

CREATE TABLE IF NOT EXISTS cuca.documentos (
  doc_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_nome TEXT NOT NULL,
  doc_tipo TEXT NOT NULL,
  doc_tamanho INTEGER,
  doc_conteudo TEXT,
  doc_embedding vector(1536),
  doc_metadados JSONB,
  doc_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  doc_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Adiciona colunas uma por uma para tabelas existentes
ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_usuario_id UUID;
UPDATE cuca.documentos SET doc_usuario_id = (SELECT id FROM auth.users LIMIT 1) WHERE doc_usuario_id IS NULL;
ALTER TABLE cuca.documentos ALTER COLUMN doc_usuario_id SET NOT NULL;

ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_nome TEXT NOT NULL DEFAULT 'untitled';
ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_tipo TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

-- ============================================
-- 4. MEMORIAS - Criar ou complementar (CORRETO)
-- ============================================

CREATE TABLE IF NOT EXISTS cuca.memorias (
  mem_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mem_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mem_conteudo TEXT NOT NULL,
  mem_relevancia INTEGER CHECK (mem_relevancia >= 1 AND mem_relevancia <= 10),
  mem_fonte TEXT,
  mem_metadados JSONB,
  mem_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  mem_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Adiciona colunas faltantes de forma segura
ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_usuario_id UUID;
UPDATE cuca.memorias SET mem_usuario_id = (SELECT id FROM auth.users LIMIT 1) WHERE mem_usuario_id IS NULL;
ALTER TABLE cuca.memorias ALTER COLUMN mem_usuario_id SET NOT NULL;

ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_conteudo TEXT NOT NULL DEFAULT '';
ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_relevancia INTEGER CHECK (mem_relevancia >= 1 AND mem_relevancia <= 10) DEFAULT 5;
ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_fonte TEXT;
ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_metadados JSONB;
ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

-- ============================================
-- 5. OUTRAS TABELAS
-- ============================================

CREATE TABLE IF NOT EXISTS cuca.cache_semantico (
  cache_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_pergunta TEXT NOT NULL,
  cache_resposta TEXT NOT NULL,
  cache_modelo TEXT NOT NULL,
  cache_embedding vector(1536),
  cache_contador INTEGER DEFAULT 1,
  cache_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  cache_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS cuca.grafo_entidades (
  ent_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ent_nome TEXT NOT NULL,
  ent_tipo TEXT NOT NULL,
  ent_metadados JSONB,
  ent_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(ent_nome, ent_tipo)
);

CREATE TABLE IF NOT EXISTS cuca.grafo_relacoes (
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

-- ============================================
-- 6. ÍNDICES (após todas as colunas estarem presentes)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_conversas_usuario ON cuca.conversas(con_usuario_id);
CREATE INDEX IF NOT EXISTS idx_conversas_atualizado ON cuca.conversas(con_atualizado_em DESC);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON cuca.mensagens(men_conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_criado ON cuca.mensagens(men_criado_em ASC);

CREATE INDEX IF NOT EXISTS idx_documentos_usuario ON cuca.documentos(doc_usuario_id);
CREATE INDEX IF NOT EXISTS idx_documentos_criado ON cuca.documentos(doc_criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_memorias_usuario ON cuca.memorias(mem_usuario_id);
CREATE INDEX IF NOT EXISTS idx_memorias_relevancia ON cuca.memorias(mem_relevancia DESC);

CREATE INDEX IF NOT EXISTS idx_cache_criado ON cuca.cache_semantico(cache_criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_entidades_tipo ON cuca.grafo_entidades(ent_tipo);
CREATE INDEX IF NOT EXISTS idx_entidades_nome ON cuca.grafo_entidades(ent_nome);

CREATE INDEX IF NOT EXISTS idx_relacoes_origem ON cuca.grafo_relacoes(rel_entidade_origem);
CREATE INDEX IF NOT EXISTS idx_relacoes_destino ON cuca.grafo_relacoes(rel_entidade_destino);

-- ============================================
-- 7. HABILITAR ROW LEVEL SECURITY
-- ============================================
ALTER TABLE cuca.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.memorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.cache_semantico ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.grafo_entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.grafo_relacoes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. POLÍTICAS RLS (criar apenas se não existirem)
-- ============================================

-- Políticas para conversas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'conversas' AND policyname = 'Usuários podem ver suas próprias conversas') THEN
    CREATE POLICY "Usuários podem ver suas próprias conversas" ON cuca.conversas FOR SELECT USING (auth.uid() = con_usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'conversas' AND policyname = 'Usuários podem criar suas próprias conversas') THEN
    CREATE POLICY "Usuários podem criar suas próprias conversas" ON cuca.conversas FOR INSERT WITH CHECK (auth.uid() = con_usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'conversas' AND policyname = 'Usuários podem atualizar suas próprias conversas') THEN
    CREATE POLICY "Usuários podem atualizar suas próprias conversas" ON cuca.conversas FOR UPDATE USING (auth.uid() = con_usuario_id) WITH CHECK (auth.uid() = con_usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'conversas' AND policyname = 'Usuários podem deletar suas próprias conversas') THEN
    CREATE POLICY "Usuários podem deletar suas próprias conversas" ON cuca.conversas FOR DELETE USING (auth.uid() = con_usuario_id);
  END IF;
END $$;

-- Políticas para mensagens
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'mensagens' AND policyname = 'Usuários podem ver mensagens de suas conversas') THEN
    CREATE POLICY "Usuários podem ver mensagens de suas conversas" ON cuca.mensagens FOR SELECT USING (
      EXISTS (SELECT 1 FROM cuca.conversas WHERE con_id = mensagens.men_conversa_id AND con_usuario_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'mensagens' AND policyname = 'Usuários podem criar mensagens em suas conversas') THEN
    CREATE POLICY "Usuários podem criar mensagens em suas conversas" ON cuca.mensagens FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM cuca.conversas WHERE con_id = mensagens.men_conversa_id AND con_usuario_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'mensagens' AND policyname = 'Usuários podem atualizar mensagens em suas conversas') THEN
    CREATE POLICY "Usuários podem atualizar mensagens em suas conversas" ON cuca.mensagens FOR UPDATE USING (
      EXISTS (SELECT 1 FROM cuca.conversas WHERE con_id = mensagens.men_conversa_id AND con_usuario_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'mensagens' AND policyname = 'Usuários podem deletar mensagens de suas conversas') THEN
    CREATE POLICY "Usuários podem deletar mensagens de suas conversas" ON cuca.mensagens FOR DELETE USING (
      EXISTS (SELECT 1 FROM cuca.conversas WHERE con_id = mensagens.men_conversa_id AND con_usuario_id = auth.uid())
    );
  END IF;
END $$;

-- Políticas para documentos
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'documentos' AND policyname = 'Usuários podem ver seus próprios documentos') THEN
    CREATE POLICY "Usuários podem ver seus próprios documentos" ON cuca.documentos FOR SELECT USING (auth.uid() = doc_usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'documentos' AND policyname = 'Usuários podem criar seus próprios documentos') THEN
    CREATE POLICY "Usuários podem criar seus próprios documentos" ON cuca.documentos FOR INSERT WITH CHECK (auth.uid() = doc_usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'documentos' AND policyname = 'Usuários podem atualizar seus próprios documentos') THEN
    CREATE POLICY "Usuários podem atualizar seus próprios documentos" ON cuca.documentos FOR UPDATE USING (auth.uid() = doc_usuario_id) WITH CHECK (auth.uid() = doc_usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'documentos' AND policyname = 'Usuários podem deletar seus próprios documentos') THEN
    CREATE POLICY "Usuários podem deletar seus próprios documentos" ON cuca.documentos FOR DELETE USING (auth.uid() = doc_usuario_id);
  END IF;
END $$;

-- Políticas para memorias
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'memorias' AND policyname = 'Usuários podem ver suas próprias memórias') THEN
    CREATE POLICY "Usuários podem ver suas próprias memórias" ON cuca.memorias FOR SELECT USING (auth.uid() = mem_usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'memorias' AND policyname = 'Usuários podem criar suas próprias memórias') THEN
    CREATE POLICY "Usuários podem criar suas próprias memórias" ON cuca.memorias FOR INSERT WITH CHECK (auth.uid() = mem_usuario_id);
  END IF;
END $$;

-- Políticas para cache_semantico (acesso livre)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'cache_semantico' AND policyname = 'Cache access') THEN
    CREATE POLICY "Cache access" ON cuca.cache_semantico FOR ALL USING (true);
  END IF;
END $$;

-- Políticas para grafo_entidades (acesso livre)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'grafo_entidades' AND policyname = 'Graph entities access') THEN
    CREATE POLICY "Graph entities access" ON cuca.grafo_entidades FOR ALL USING (true);
  END IF;
END $$;

-- Políticas para grafo_relacoes (acesso livre)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'grafo_relacoes' AND policyname = 'Graph relations access') THEN
    CREATE POLICY "Graph relations access" ON cuca.grafo_relacoes FOR ALL USING (true);
  END IF;
END $$;

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================
-- Agora todas as tabelas devem ter as colunas necessárias
-- Teste enviando uma mensagem no chat