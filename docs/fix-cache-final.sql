-- ============================================
-- FIX CACHE_SEMANTICO - RENOMEAR COLUNAS
-- ============================================
-- Execute no Supabase SQL Editor

-- Renomear colunas da tabela cache_semantico
ALTER TABLE cuca.cache_semantico RENAME COLUMN cache_pergunta TO cac_pergunta;
ALTER TABLE cuca.cache_semantico RENAME COLUMN cache_resposta TO cac_resposta;
ALTER TABLE cuca.cache_semantico RENAME COLUMN cache_modelo TO cac_modelo;
ALTER TABLE cuca.cache_semantico RENAME COLUMN cache_embedding TO cac_embedding;
ALTER TABLE cuca.cache_semantico RENAME COLUMN cache_contador TO cac_contador;
ALTER TABLE cuca.cache_semantico RENAME COLUMN cache_criado_em TO cac_criado_em;
ALTER TABLE cuca.cache_semantico RENAME COLUMN cache_atualizado_em TO cac_atualizado_em;
ALTER TABLE cuca.cache_semantico RENAME COLUMN cache_id TO cac_id;

-- Criar índice apenas se não existir (usar nome diferente para evitar conflito)
CREATE INDEX IF NOT EXISTS idx_cache_cac_criado ON cuca.cache_semantico(cac_criado_em DESC);

-- Pronto!