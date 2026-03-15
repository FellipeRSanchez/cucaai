-- ============================================
-- MIGRAÇÃO: ADICIONAR COLUNAS FALTANTES
-- ============================================
-- Execute este arquivo para corrigir tabelas existentes
-- que estão com colunas faltando
-- SEGURO: Não apaga dados existentes

-- Criar schema se não existir
CREATE SCHEMA IF NOT EXISTS cuca;

-- ============================================
-- TABELA: conversas
-- Adicionar coluna con_usuario_id se não existir
-- ============================================
DO $$ 
BEGIN
  -- Verifica se a coluna existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'cuca' 
    AND table_name = 'conversas' 
    AND column_name = 'con_usuario_id'
  ) THEN
    ALTER TABLE cuca.conversas ADD COLUMN con_usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- Atualizar registros existentes com um usuário padrão se necessário
    -- (Você pode precisar ajustar isso baseado no seu contexto)
    UPDATE cuca.conversas 
    SET con_usuario_id = '00000000-0000-0000-0000-000000000000' 
    WHERE con_usuario_id IS NULL;
    
    -- Tornar NOT NULL após popular
    ALTER TABLE cuca.conversas ALTER COLUMN con_usuario_id SET NOT NULL;
  END IF;
END $$;

-- Adicionar colunas de timestamp se faltarem
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'cuca' 
    AND table_name = 'conversas' 
    AND column_name = 'con_criado_em'
  ) THEN
    ALTER TABLE cuca.conversas ADD COLUMN con_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'cuca' 
    AND table_name = 'conversas' 
    AND column_name = 'con_atualizado_em'
  ) THEN
    ALTER TABLE cuca.conversas ADD COLUMN con_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
  END IF;
END $$;

-- Adicionar índice se não existir
CREATE INDEX IF NOT EXISTS idx_conversas_usuario ON cuca.conversas(con_usuario_id);
CREATE INDEX IF NOT EXISTS idx_conversas_atualizado ON cuca.conversas(con_atualizado_em DESC);

-- ============================================
-- TABELA: mensagens
-- Criar se não existir, ou adicionar colunas faltantes
-- ============================================
CREATE TABLE IF NOT EXISTS cuca.mensagens (
  men_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  men_conversa_id UUID NOT NULL REFERENCES cuca.conversas(con_id) ON DELETE CASCADE,
  men_papel TEXT NOT NULL CHECK (men_papel IN ('user', 'assistant')),
  men_conteudo TEXT NOT NULL,
  men_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Se a tabela já existe mas sem algumas colunas, adicionar
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'cuca' 
    AND table_name = 'mensagens'
  ) THEN
    -- Adicionar coluna men_conteudo se faltar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'mensagens' 
      AND column_name = 'men_conteudo'
    ) THEN
      ALTER TABLE cuca.mensagens ADD COLUMN men_conteudo TEXT NOT NULL DEFAULT '';
    END IF;
    
    -- Adicionar coluna men_criado_em se faltar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'mensagens' 
      AND column_name = 'men_criado_em'
    ) THEN
      ALTER TABLE cuca.mensagens ADD COLUMN men_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
    END IF;
    
    -- Adicionar coluna men_papel se faltar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'mensagens' 
      AND column_name = 'men_papel'
    ) THEN
      ALTER TABLE cuca.mensagens ADD COLUMN men_papel TEXT NOT NULL DEFAULT 'user';
    END IF;
    
    -- Adicionar coluna men_conversa_id se faltar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'mensagens' 
      AND column_name = 'men_conversa_id'
    ) THEN
      ALTER TABLE cuca.mensagens ADD COLUMN men_conversa_id UUID REFERENCES cuca.conversas(con_id);
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON cuca.mensagens(men_conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_criado ON cuca.mensagens(men_criado_em ASC);

-- ============================================
-- TABELA: documentos
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

-- Se já existe, adicionar colunas faltantes
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'cuca' 
    AND table_name = 'documentos'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'documentos' 
      AND column_name = 'doc_usuario_id'
    ) THEN
      ALTER TABLE cuca.documentos ADD COLUMN doc_usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      UPDATE cuca.documentos SET doc_usuario_id = '00000000-0000-0000-0000-000000000000' WHERE doc_usuario_id IS NULL;
      ALTER TABLE cuca.documentos ALTER COLUMN doc_usuario_id SET NOT NULL;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'documentos' 
      AND column_name = 'doc_nome'
    ) THEN
      ALTER TABLE cuca.documentos ADD COLUMN doc_nome TEXT NOT NULL DEFAULT 'untitled';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'documentos' 
      AND column_name = 'doc_tipo'
    ) THEN
      ALTER TABLE cuca.documentos ADD COLUMN doc_tipo TEXT NOT NULL DEFAULT 'unknown';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'documentos' 
      AND column_name = 'doc_criado_em'
    ) THEN
      ALTER TABLE cuca.documentos ADD COLUMN doc_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'documentos' 
      AND column_name = 'doc_atualizado_em'
    ) THEN
      ALTER TABLE cuca.documentos ADD COLUMN doc_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documentos_usuario ON cuca.documentos(doc_usuario_id);
CREATE INDEX IF NOT EXISTS idx_documentos_criado ON cuca.documentos(doc_criado_em DESC);

-- ============================================
-- TABELA: memorias
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

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'cuca' 
    AND table_name = 'memorias'
  ) THEN
    -- Adicionar coluna mem_usuario_id se faltar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'memorias' 
      AND column_name = 'mem_usuario_id'
    ) THEN
      ALTER TABLE cuca.memorias ADD COLUMN mem_usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      UPDATE cuca.memorias SET mem_usuario_id = '00000000-0000-0000-0000-000000000000' WHERE mem_usuario_id IS NULL;
      ALTER TABLE cuca.memorias ALTER COLUMN mem_usuario_id SET NOT NULL;
    END IF;
    
    -- Adicionar coluna mem_conteudo se faltar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'memorias' 
      AND column_name = 'mem_conteudo'
    ) THEN
      ALTER TABLE cuca.memorias ADD COLUMN mem_conteudo TEXT NOT NULL DEFAULT '';
    END IF;
    
    -- Adicionar coluna mem_relevancia se faltar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'memorias' 
      AND column_name = 'mem_relevancia'
    ) THEN
      ALTER TABLE cuca.memorias ADD COLUMN mem_relevancia INTEGER CHECK (mem_relevancia >= 1 AND mem_relevancia <= 10) DEFAULT 5;
    END IF;
    
    -- Adicionar coluna mem_fonte se faltar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'memorias' 
      AND column_name = 'mem_fonte'
    ) THEN
      ALTER TABLE cuca.memorias ADD COLUMN mem_fonte TEXT;
    END IF;
    
    -- Adicionar coluna mem_metadados se faltar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'memorias' 
      AND column_name = 'mem_metadados'
    ) THEN
      ALTER TABLE cuca.memorias ADD COLUMN mem_metadados JSONB;
    END IF;
    
    -- Adicionar coluna mem_criado_em se faltar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'memorias' 
      AND column_name = 'mem_criado_em'
    ) THEN
      ALTER TABLE cuca.memorias ADD COLUMN mem_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
    END IF;
    
    -- Adicionar coluna mem_atualizado_em se faltar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'cuca' 
      AND table_name = 'memorias' 
      AND column_name = 'mem_atualizado_em'
    ) THEN
      ALTER TABLE cuca.memorias ADD COLUMN mem_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_memorias_usuario ON cuca.memorias(mem_usuario_id);
CREATE INDEX IF NOT EXISTS idx_memorias_relevancia ON cuca.memorias(mem_relevancia DESC);

-- ============================================
-- TABELA: cache_semantico
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

-- ============================================
-- TABELA: grafo_entidades
-- ============================================
CREATE TABLE IF NOT EXISTS cuca.grafo_entidades (
  ent_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ent_nome TEXT NOT NULL,
  ent_tipo TEXT NOT NULL,
  ent_metadados JSONB,
  ent_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(ent_nome, ent_tipo)
);

-- ============================================
-- TABELA: grafo_relacoes
-- ============================================
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
-- HABILITAR RLS (se ainda não estiver habilitado)
-- ============================================
ALTER TABLE cuca.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.memorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.cache_semantico ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.grafo_entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.grafo_relacoes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CRIAR POLÍTICAS RLS (apenas se não existirem)
-- ============================================

-- Políticas para conversas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'conversas' 
    AND policyname = 'Usuários podem ver suas próprias conversas'
  ) THEN
    CREATE POLICY "Usuários podem ver suas próprias conversas"
      ON cuca.conversas FOR SELECT
      USING (auth.uid() = con_usuario_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'conversas' 
    AND policyname = 'Usuários podem criar suas próprias conversas'
  ) THEN
    CREATE POLICY "Usuários podem criar suas próprias conversas"
      ON cuca.conversas FOR INSERT
      WITH CHECK (auth.uid() = con_usuario_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'conversas' 
    AND policyname = 'Usuários podem atualizar suas próprias conversas'
  ) THEN
    CREATE POLICY "Usuários podem atualizar suas próprias conversas"
      ON cuca.conversas FOR UPDATE
      USING (auth.uid() = con_usuario_id)
      WITH CHECK (auth.uid() = con_usuario_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'conversas' 
    AND policyname = 'Usuários podem deletar suas próprias conversas'
  ) THEN
    CREATE POLICY "Usuários podem deletar suas próprias conversas"
      ON cuca.conversas FOR DELETE
      USING (auth.uid() = con_usuario_id);
  END IF;
END $$;

-- Políticas para mensagens
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'mensagens' 
    AND policyname = 'Usuários podem ver mensagens de suas conversas'
  ) THEN
    CREATE POLICY "Usuários podem ver mensagens de suas conversas"
      ON cuca.mensagens FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM cuca.conversas
          WHERE con_id = mensagens.men_conversa_id
          AND con_usuario_id = auth.uid()
        )
      );
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'mensagens' 
    AND policyname = 'Usuários podem criar mensagens em suas conversas'
  ) THEN
    CREATE POLICY "Usuários podem criar mensagens em suas conversas"
      ON cuca.mensagens FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM cuca.conversas
          WHERE con_id = mensagens.men_conversa_id
          AND con_usuario_id = auth.uid()
        )
      );
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'mensagens' 
    AND policyname = 'Usuários podem atualizar mensagens em suas conversas'
  ) THEN
    CREATE POLICY "Usuários podem atualizar mensagens em suas conversas"
      ON cuca.mensagens FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM cuca.conversas
          WHERE con_id = mensagens.men_conversa_id
          AND con_usuario_id = auth.uid()
        )
      );
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'mensagens' 
    AND policyname = 'Usuários podem deletar mensagens de suas conversas'
  ) THEN
    CREATE POLICY "Usuários podem deletar mensagens de suas conversas"
      ON cuca.mensagens FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM cuca.conversas
          WHERE con_id = mensagens.men_conversa_id
          AND con_usuario_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Políticas para documentos
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'documentos' 
    AND policyname = 'Usuários podem ver seus próprios documentos'
  ) THEN
    CREATE POLICY "Usuários podem ver seus próprios documentos"
      ON cuca.documentos FOR SELECT
      USING (auth.uid() = doc_usuario_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'documentos' 
    AND policyname = 'Usuários podem criar seus próprios documentos'
  ) THEN
    CREATE POLICY "Usuários podem criar seus próprios documentos"
      ON cuca.documentos FOR INSERT
      WITH CHECK (auth.uid() = doc_usuario_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'documentos' 
    AND policyname = 'Usuários podem atualizar seus próprios documentos'
  ) THEN
    CREATE POLICY "Usuários podem atualizar seus próprios documentos"
      ON cuca.documentos FOR UPDATE
      USING (auth.uid() = doc_usuario_id)
      WITH CHECK (auth.uid() = doc_usuario_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'documentos' 
    AND policyname = 'Usuários podem deletar seus próprios documentos'
  ) THEN
    CREATE POLICY "Usuários podem deletar seus próprios documentos"
      ON cuca.documentos FOR DELETE
      USING (auth.uid() = doc_usuario_id);
  END IF;
END $$;

-- Políticas para memorias
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'memorias' 
    AND policyname = 'Usuários podem ver suas próprias memórias'
  ) THEN
    CREATE POLICY "Usuários podem ver suas próprias memórias"
      ON cuca.memorias FOR SELECT
      USING (auth.uid() = mem_usuario_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'cuca' 
    AND tablename = 'memorias' 
    AND policyname = 'Usuários podem criar suas próprias memórias'
  ) THEN
    CREATE POLICY "Usuários podem criar suas próprias memórias"
      ON cuca.memorias FOR INSERT
      WITH CHECK (auth.uid() = mem_usuario_id);
  END IF;
END $$;

-- NOTA IMPORTANTE:
-- Para as tabelas cache_semantico, grafo_entidades, grafo_relacoes
-- as políticas RLS foram definidas como permissivas (USING true)
-- para permitir acesso compartilhado. Se precisar de políticas restritivas,
-- modifique conforme necessário.

-- EXTENSÃO pgvector (execute separadamente se não existir)
-- CREATE EXTENSION IF NOT EXISTS vector;