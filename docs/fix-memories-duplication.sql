-- ============================================
-- CORREÇÃO: Adicionar coluna de embedding e prevenir duplicatas na tabela memorias
-- ============================================
-- Execute este arquivo no Supabase SQL Editor
-- para corrigir a tabela memorias adicionando suporte a embeddings e constraints

-- 1. Adicionar coluna mem_embedding se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'cuca' 
        AND table_name = 'memorias' 
        AND column_name = 'mem_embedding'
    ) THEN
        ALTER TABLE cuca.memorias ADD COLUMN mem_embedding VECTOR(1536);
        RAISE NOTICE 'Coluna mem_embedding adicionada';
    ELSE
        RAISE NOTICE 'Coluna mem_embedding já existe';
    END IF;
END $$;

-- 2. Adicionar constraint única para evitar duplicatas exatas (opcional, mas recomendado)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'cuca' 
        AND table_name = 'memorias' 
        AND constraint_name = 'uk_memorias_usuario_conteudo'
    ) THEN
        ALTER TABLE cuca.memorias ADD CONSTRAINT uk_memorias_usuario_conteudo UNIQUE (mem_usuario_id, mem_conteudo);
        RAISE NOTICE 'Constraint única uk_memorias_usuario_conteudo adicionada';
    ELSE
        RAISE NOTICE 'Constraint única uk_memorias_usuario_conteudo já existe';
    END IF;
END $$;

-- 3. Criar ou atualizar a função RPC para buscar memórias similares por embedding
-- Função: match_memorias
-- Parâmetros:
--   query_embedding: vetor de embedding da consulta
--   match_threshold: limiar de similaridade (padrão 0.90)
--   match_count: número máximo de resultados (padrão 1)
--   p_user_id: ID do usuário para filtrar memórias
CREATE OR REPLACE FUNCTION cuca.match_memorias (
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.90,
    match_count INT DEFAULT 1,
    p_user_id UUID
)
RETURNS TABLE (
    mem_id UUID,
    mem_usuario_id UUID,
    mem_conteudo TEXT,
    mem_relevancia INTEGER,
    mem_fonte TEXT,
    mem_metadados JSONB,
    mem_criado_em TIMESTAMP WITH TIME ZONE,
    mem_atualizado_em TIMESTAMP WITH TIME ZONE,
    similarity FLOAT
)
LANGUAGE sql
AS $$
    SELECT
        memorias.mem_id,
        memorias.mem_usuario_id,
        memorias.mem_conteudo,
        memorias.mem_relevancia,
        memorias.mem_fonte,
        memorias.mem_metadados,
        memorias.mem_criado_em,
        memorias.mem_atualizado_em,
        1 - (memorias.mem_embedding <=> query_embedding) AS similarity
    FROM cuca.memorias
    WHERE memorias.mem_usuario_id = p_user_id
      AND memorias.mem_embedding IS NOT NULL
      AND 1 - (memorias.mem_embedding <=> query_embedding) >= match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
$$;

-- 4. Habilitar a extensão vector se ainda não estiver habilitada (deve ser feita uma vez no banco)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- 5. Verificar estrutura final da tabela
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'cuca' 
AND table_name = 'memorias' 
ORDER BY ordinal_position;

-- 6. Listar constraints para verificar
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_schema = 'cuca' 
AND table_name = 'memorias';