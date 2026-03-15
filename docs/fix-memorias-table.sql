-- ============================================
-- CORREÇÃO: Adicionar colunas faltantes na tabela memorias
-- ============================================
-- Execute este arquivo no Supabase SQL Editor
-- para corrigir a tabela memorias que está com colunas faltantes

-- Adicionar coluna mem_fonte se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'cuca' 
        AND table_name = 'memorias' 
        AND column_name = 'mem_fonte'
    ) THEN
        ALTER TABLE cuca.memorias ADD COLUMN mem_fonte TEXT;
        RAISE NOTICE 'Coluna mem_fonte adicionada';
    ELSE
        RAISE NOTICE 'Coluna mem_fonte já existe';
    END IF;
END $$;

-- Adicionar coluna mem_relevancia se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'cuca' 
        AND table_name = 'memorias' 
        AND column_name = 'mem_relevancia'
    ) THEN
        ALTER TABLE cuca.memorias ADD COLUMN mem_relevancia INTEGER CHECK (mem_relevancia >= 1 AND mem_relevancia <= 10);
        RAISE NOTICE 'Coluna mem_relevancia adicionada';
    ELSE
        RAISE NOTICE 'Coluna mem_relevancia já existe';
    END IF;
END $$;

-- Adicionar coluna mem_metadados se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'cuca' 
        AND table_name = 'memorias' 
        AND column_name = 'mem_metadados'
    ) THEN
        ALTER TABLE cuca.memorias ADD COLUMN mem_metadados JSONB;
        RAISE NOTICE 'Coluna mem_metadados adicionada';
    ELSE
        RAISE NOTICE 'Coluna mem_metadados já existe';
    END IF;
END $$;

-- Adicionar coluna mem_atualizado_em se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'cuca' 
        AND table_name = 'memorias' 
        AND column_name = 'mem_atualizado_em'
    ) THEN
        ALTER TABLE cuca.memorias ADD COLUMN mem_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;
        RAISE NOTICE 'Coluna mem_atualizado_em adicionada';
    ELSE
        RAISE NOTICE 'Coluna mem_atualizado_em já existe';
    END IF;
END $$;

-- Verificar estrutura final da tabela
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'cuca' 
AND table_name = 'memorias' 
ORDER BY ordinal_position;