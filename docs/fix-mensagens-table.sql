-- ============================================
-- RECREATE MENSAGENS TABLE WITH CORRECT STRUCTURE
-- ============================================
-- Execute no Supabase SQL Editor
-- A tabela está vazia, então é seguro recriar

-- 1. Drop a tabela existente (ignora se não existir)
DROP TABLE IF EXISTS cuca.mensagens CASCADE;

-- 2. Recria com a estrutura correta que o código espera
CREATE TABLE cuca.mensagens (
  men_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  men_conversa_id UUID NOT NULL REFERENCES cuca.conversas(con_id) ON DELETE CASCADE,
  men_papel TEXT NOT NULL CHECK (men_papel IN ('user', 'assistant')),
  men_conteudo TEXT NOT NULL,
  men_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Concede permissões
GRANT ALL ON cuca.mensagens TO service_role;
GRANT ALL ON cuca.mensagens TO authenticated;

-- 4. Habilita RLS
ALTER TABLE cuca.mensagens ENABLE ROW LEVEL SECURITY;

-- 5. Cria políticas RLS
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

-- 6. Cria índices
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON cuca.mensagens(men_conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_criado ON cuca.mensagens(men_criado_em ASC);

-- ============================================
-- PRONTO!
-- Agora a tabela mensagens tem a estrutura correta:
-- men_id, men_conversa_id, men_papel, men_conteudo, men_criado_em
-- ============================================