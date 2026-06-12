-- ============================================
-- CORREÇÃO DE PERMISSÕES DO SCHEMA CUCA
-- ============================================
-- Este script resolve o erro:
-- "permission denied for schema cuca"
-- "The schema must be one of the following: public, graphql_public"

-- ============================================
-- 1. CONCEDER PERMISSÕES AO SERVICE ROLE
-- ============================================

-- Permissão total para o service role no schema cuca
GRANT ALL ON SCHEMA cuca TO service_role;
GRANT ALL ON SCHEMA cuca TO postgres;
GRANT ALL ON SCHEMA cuca TO authenticated;

-- Permissões em todas as tabelas existentes e futuras
GRANT ALL ON ALL TABLES IN SCHEMA cuca TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA cuca TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA cuca TO authenticated;

-- Permissões em sequencias
GRANT ALL ON ALL SEQUENCES IN SCHEMA cuca TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA cuca TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA cuca TO authenticated;

-- Permissões em funções
GRANT ALL ON ALL FUNCTIONS IN SCHEMA cuca TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA cuca TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA cuca TO authenticated;

-- ============================================
-- 2. CONFIGURAR DEFAULT PRIVILEGES
-- (Para que novas tabelas também tenham permissões)
-- ============================================

ALTER DEFAULT PRIVILEGES IN SCHEMA cuca GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cuca GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA cuca GRANT ALL ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA cuca GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cuca GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA cuca GRANT ALL ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA cuca GRANT ALL ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA cuca GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA cuca GRANT ALL ON FUNCTIONS TO authenticated;

-- ============================================
-- 3. EXPOR O SCHEMA CUCA NO POSTGREST
-- ============================================
-- O PostgREST (API REST do Supabase) só expõe schemas listados
-- Precisamos adicionar 'cuca' à configuração

-- Nota: Esta configuração geralmente é feita via Dashboard
-- Supabase Dashboard → Settings → API → Schema
-- Mas podemos tentar via SQL:

COMMENT ON SCHEMA cuca IS 'Cuca AI workspace schema';

-- Garantir que o schema é propriedade do postgres (para PostgREST funcionar)
ALTER SCHEMA cuca OWNER TO postgres;

-- ============================================
-- 4. VERIFICAR SE AS TABELAS EXISTEM
-- ============================================

-- Se as tabelas não existem, criar agora
CREATE TABLE IF NOT EXISTS cuca.conversas (
  con_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  con_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  con_titulo TEXT NOT NULL,
  con_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  con_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS cuca.mensagens (
  men_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  men_conversa_id UUID NOT NULL REFERENCES cuca.conversas(con_id) ON DELETE CASCADE,
  men_papel TEXT NOT NULL CHECK (men_papel IN ('user', 'assistant')),
  men_conteudo TEXT NOT NULL,
  men_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

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
-- 5. CONCEDER PERMISSÕES NAS TABELAS ESPECÍFICAS
-- ============================================

GRANT ALL ON cuca.conversas TO service_role;
GRANT ALL ON cuca.conversas TO authenticated;

GRANT ALL ON cuca.mensagens TO service_role;
GRANT ALL ON cuca.mensagens TO authenticated;

GRANT ALL ON cuca.documentos TO service_role;
GRANT ALL ON cuca.documentos TO authenticated;

GRANT ALL ON cuca.memorias TO service_role;
GRANT ALL ON cuca.memorias TO authenticated;

GRANT ALL ON cuca.cache_semantico TO service_role;
GRANT ALL ON cuca.cache_semantico TO authenticated;

GRANT ALL ON cuca.grafo_entidades TO service_role;
GRANT ALL ON cuca.grafo_entidades TO authenticated;

GRANT ALL ON cuca.grafo_relacoes TO service_role;
GRANT ALL ON cuca.grafo_relacoes TO authenticated;

-- ============================================
-- 6. HABILITAR RLS
-- ============================================

ALTER TABLE cuca.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.memorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.cache_semantico ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.grafo_entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.grafo_relacoes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. CRIAR POLÍTICAS RLS
-- ============================================

-- conversas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'conversas' AND policyname = 'Usuários podem ver suas próprias conversas') THEN
    CREATE POLICY "Usuários podem ver suas próprias conversas" ON cuca.conversas FOR SELECT USING (auth.uid() = con_usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'conversas' AND policyname = 'Usuários podem criar suas próprias conversas') THEN
    CREATE POLICY "Usuários podem criar suas próprias conversas" ON cuca.conversas FOR INSERT WITH CHECK (auth.uid() = con_usuario_id);
  END IF;
END $$;

-- mensagens
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

-- documentos
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'documentos' AND policyname = 'Usuários podem ver seus próprios documentos') THEN
    CREATE POLICY "Usuários podem ver seus próprios documentos" ON cuca.documentos FOR SELECT USING (auth.uid() = doc_usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'documentos' AND policyname = 'Usuários podem criar seus próprios documentos') THEN
    CREATE POLICY "Usuários podem criar seus próprios documentos" ON cuca.documentos FOR INSERT WITH CHECK (auth.uid() = doc_usuario_id);
  END IF;
END $$;

-- memorias
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'memorias' AND policyname = 'Usuários podem ver suas próprias memórias') THEN
    CREATE POLICY "Usuários podem ver suas próprias memórias" ON cuca.memorias FOR SELECT USING (auth.uid() = mem_usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'memorias' AND policyname = 'Usuários podem criar suas próprias memórias') THEN
    CREATE POLICY "Usuários podem criar suas próprias memórias" ON cuca.memorias FOR INSERT WITH CHECK (auth.uid() = mem_usuario_id);
  END IF;
END $$;

-- cache_semantico (acesso livre)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'cache_semantico' AND policyname = 'Cache access') THEN
    CREATE POLICY "Cache access" ON cuca.cache_semantico FOR ALL USING (true);
  END IF;
END $$;

-- grafo_entidades (acesso livre)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'grafo_entidades' AND policyname = 'Graph entities access') THEN
    CREATE POLICY "Graph entities access" ON cuca.grafo_entidades FOR ALL USING (true);
  END IF;
END $$;

-- grafo_relacoes (acesso livre)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'cuca' AND tablename = 'grafo_relacoes' AND policyname = 'Graph relations access') THEN
    CREATE POLICY "Graph relations access" ON cuca.grafo_relacoes FOR ALL USING (true);
  END IF;
END $$;

-- ============================================
-- FIM
-- ============================================
-- ✅ Permissões concedidas
-- ✅ Tabelas criadas
-- ✅ RLS habilitado
-- 
-- IMPORTANTE: Após executar este script, vá em:
-- Supabase Dashboard → Settings → API → Schema
-- E adicione 'cuca' à lista de schemas expostos
-- ============================================