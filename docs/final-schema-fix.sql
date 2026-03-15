-- ============================================
-- FIX FINAL E DEFINITIVO PARA O SCHEMA CUCA
-- ============================================
-- ✅ Execute ESTE arquivo no Supabase SQL Editor
-- ✅ Seguro para executar múltiplas vezes
-- ✅ Adiciona colunasantes de criar índices
-- ✅ Sem erros de "column does not exist"

-- ============================================
-- PASSO 1: Garantir schema
-- ============================================
CREATE SCHEMA IF NOT EXISTS cuca;

-- ============================================
-- PASSO 2: Adicionar TODAS as colunas necessárias
-- (Ordem importante: colunas antes de índices)
-- ============================================

-- Tabela: conversas
ALTER TABLE cuca.conversas ADD COLUMN IF NOT EXISTS con_usuario_id UUID;
ALTER TABLE cuca.conversas ADD COLUMN IF NOT EXISTS con_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
ALTER TABLE cuca.conversas ADD COLUMN IF NOT EXISTS con_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

-- Tabela: mensagens
ALTER TABLE cuca.mensagens ADD COLUMN IF NOT EXISTS men_conteudo TEXT NOT NULL DEFAULT '';
ALTER TABLE cuca.mensagens ADD COLUMN IF NOT EXISTS men_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
ALTER TABLE cuca.mensagens ADD COLUMN IF NOT EXISTS men_papel TEXT NOT NULL DEFAULT 'user';
ALTER TABLE cuca.mensagens ADD COLUMN IF NOT EXISTS men_conversa_id UUID REFERENCES cuca.conversas(con_id);

-- Tabela: documentos
ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_usuario_id UUID;
ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_nome TEXT NOT NULL DEFAULT 'untitled';
ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_tipo TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

-- Tabela: memorias
ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_usuario_id UUID;
ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_conteudo TEXT NOT NULL DEFAULT '';
ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_relevancia INTEGER CHECK (mem_relevancia >= 1 AND mem_relevancia <= 10) DEFAULT 5;
ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_fonte TEXT;
ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_metadados JSONB;
ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
ALTER TABLE cuca.memorias ADD COLUMN IF NOT EXISTS mem_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

-- Tabela: cache_semantico
ALTER TABLE cuca.cache_semantico ADD COLUMN IF NOT EXISTS cache_pergunta TEXT NOT NULL DEFAULT '';
ALTER TABLE cuca.cache_semantico ADD COLUMN IF NOT EXISTS cache_resposta TEXT NOT NULL DEFAULT '';
ALTER TABLE cuca.cache_semantico ADD COLUMN IF NOT EXISTS cache_modelo TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE cuca.cache_semantico ADD COLUMN IF NOT EXISTS cache_contador INTEGER DEFAULT 1;
ALTER TABLE cuca.cache_semantico ADD COLUMN IF NOT EXISTS cache_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
ALTER TABLE cuca.cache_semantico ADD COLUMN IF NOT EXISTS cache_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

-- ============================================
-- PASSO 3: Popular valores NULL com dados válidos
-- ============================================

-- conversas: atribuir a um usuário existente
UPDATE cuca.conversas 
SET con_usuario_id = (SELECT id FROM auth.users LIMIT 1) 
WHERE con_usuario_id IS NULL;

-- documentos: atribuir a um usuário existente
UPDATE cuca.documentos 
SET doc_usuario_id = (SELECT id FROM auth.users LIMIT 1) 
WHERE doc_usuario_id IS NULL;

-- memorias: atribuir a um usuário existente
UPDATE cuca.memorias 
SET mem_usuario_id = (SELECT id FROM auth.users LIMIT 1) 
WHERE mem_usuario_id IS NULL;

-- ============================================
-- PASSO 4: Tornar colunas NOT NULL (após popular)
-- ============================================

ALTER TABLE cuca.conversas ALTER COLUMN con_usuario_id SET NOT NULL;
ALTER TABLE cuca.documentos ALTER COLUMN doc_usuario_id SET NOT NULL;
ALTER TABLE cuca.memorias ALTER COLUMN mem_usuario_id SET NOT NULL;

-- ============================================
-- PASSO 5: Criar/ adicionar constraints de foreign key
-- ============================================

-- FK para conversas.con_usuario_id
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
-- PASSO 6: AGORA sim, criar índices (após colunas existirem)
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

-- Memorias
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
-- PASSO 7: Habilitar RLS
-- ============================================
ALTER TABLE cuca.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.memorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.cache_semantico ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.grafo_entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.grafo_relacoes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASSO 8: Criar políticas RLS (se não existirem)
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
-- FIM
-- ============================================
-- ✅ Todas as colunas adicionadas
-- ✅ Todos os índices criados (após colunas existirem)
-- ✅ Todas as políticas configuradas
-- ============================================
-- Agora teste: envie uma mensagem no chat!
-- ============================================