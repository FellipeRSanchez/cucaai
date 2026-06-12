-- ============================================
-- TABELA: projetos
-- ============================================
CREATE TABLE IF NOT EXISTS cuca.projetos (
  pro_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pro_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pro_nome TEXT NOT NULL,
  pro_descricao TEXT,
  pro_system_prompt TEXT,
  pro_emoji TEXT DEFAULT '📁',
  pro_cor TEXT DEFAULT '#6366f1',
  pro_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  pro_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- ADICIONAR FK de projeto nas tabelas existentes
-- ============================================

ALTER TABLE cuca.conversas
  ADD COLUMN IF NOT EXISTS con_projeto_id UUID REFERENCES cuca.projetos(pro_id) ON DELETE SET NULL;

ALTER TABLE cuca.documentos
  ADD COLUMN IF NOT EXISTS doc_projeto_id UUID REFERENCES cuca.projetos(pro_id) ON DELETE SET NULL;

ALTER TABLE cuca.memorias
  ADD COLUMN IF NOT EXISTS mem_projeto_id UUID REFERENCES cuca.projetos(pro_id) ON DELETE SET NULL;

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_projetos_usuario ON cuca.projetos(pro_usuario_id);
CREATE INDEX IF NOT EXISTS idx_conversas_projeto ON cuca.conversas(con_projeto_id);
CREATE INDEX IF NOT EXISTS idx_documentos_projeto ON cuca.documentos(doc_projeto_id);
CREATE INDEX IF NOT EXISTS idx_memorias_projeto ON cuca.memorias(mem_projeto_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE cuca.projetos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: projetos
CREATE POLICY "Usuários podem ver seus próprios projetos"
  ON cuca.projetos FOR SELECT
  USING (auth.uid() = pro_usuario_id);

CREATE POLICY "Usuários podem criar seus próprios projetos"
  ON cuca.projetos FOR INSERT
  WITH CHECK (auth.uid() = pro_usuario_id);

CREATE POLICY "Usuários podem atualizar seus próprios projetos"
  ON cuca.projetos FOR UPDATE
  USING (auth.uid() = pro_usuario_id)
  WITH CHECK (auth.uid() = pro_usuario_id);

CREATE POLICY "Usuários podem deletar seus próprios projetos"
  ON cuca.projetos FOR DELETE
  USING (auth.uid() = pro_usuario_id);
