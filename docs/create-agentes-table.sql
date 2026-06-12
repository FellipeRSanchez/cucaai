-- Tabela de agentes customizados por usuário
CREATE TABLE IF NOT EXISTS cuca.agentes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  emoji TEXT DEFAULT '🤖',
  system_prompt TEXT NOT NULL,
  ferramentas TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE cuca.agentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus agentes" ON cuca.agentes
  FOR ALL USING (auth.uid() = usuario_id);

-- Índice
CREATE INDEX IF NOT EXISTS idx_agentes_usuario_id ON cuca.agentes(usuario_id);