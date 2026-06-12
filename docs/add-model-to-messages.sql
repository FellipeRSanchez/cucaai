-- ============================================
-- MIGRATION: Adicionar coluna de modelo às mensagens
-- ============================================
-- Execute este arquivo no Supabase SQL Editor
-- para adicionar a coluna que armazena qual modelo
-- foi usado para gerar cada resposta

-- Adicionar coluna men_modelo na tabela mensagens
ALTER TABLE cuca.mensagens 
ADD COLUMN IF NOT EXISTS men_modelo TEXT;

-- Adicionar comentário explicativo
COMMENT ON COLUMN cuca.mensagens.men_modelo IS 'ID do modelo de IA usado para gerar a resposta (ex: openai/chatgpt-4o-latest)';

-- Criar índice para consultas por modelo
CREATE INDEX IF NOT EXISTS idx_mensagens_modelo ON cuca.mensagens(men_modelo);