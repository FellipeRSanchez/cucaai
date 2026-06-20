-- ============================================
-- FIX: Mover match_memorias para schema public
-- ============================================
-- O supabase.rpc() so encontra funcoes no schema public.
-- A funcao match_memorias estava no schema cuca, causando falha silenciosa.
-- Execute no Supabase SQL Editor.

-- 1. Remover funcao existente no schema public (se houver)
DROP FUNCTION IF EXISTS public.match_memorias;

-- 2. Criar a funcao no schema public (p_user_id antes dos parametros com default)
CREATE OR REPLACE FUNCTION public.match_memorias (
    query_embedding VECTOR(1536),
    p_user_id UUID,
    match_threshold FLOAT DEFAULT 0.90,
    match_count INT DEFAULT 1
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
SECURITY DEFINER
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

-- 3. Conceder permissao para authenticated e service_role
GRANT EXECUTE ON FUNCTION public.match_memorias TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_memorias TO service_role;
