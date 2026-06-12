-- ============================================
-- MIGRAÇÃO: public.modelos -> cuca.modelos
-- ============================================
-- Execute no Supabase SQL Editor

CREATE SCHEMA IF NOT EXISTS cuca;

CREATE TABLE IF NOT EXISTS cuca.modelos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL,
  context_length INTEGER,
  pricing_prompt NUMERIC,
  pricing_completion NUMERIC,
  modality TEXT,
  capabilities JSONB,
  tags TEXT[],
  is_free BOOLEAN DEFAULT false,
  top_provider JSONB,
  architecture JSONB,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Migra dados existentes do schema public para cuca
INSERT INTO cuca.modelos (
  id,
  name,
  description,
  provider,
  context_length,
  pricing_prompt,
  pricing_completion,
  modality,
  capabilities,
  tags,
  is_free,
  top_provider,
  architecture,
  last_synced_at
)
SELECT
  id,
  name,
  description,
  provider,
  context_length,
  pricing_prompt,
  pricing_completion,
  modality,
  capabilities,
  tags,
  is_free,
  top_provider,
  architecture,
  COALESCE(last_synced_at, TIMEZONE('utc'::text, NOW()))
FROM public.modelos
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  provider = EXCLUDED.provider,
  context_length = EXCLUDED.context_length,
  pricing_prompt = EXCLUDED.pricing_prompt,
  pricing_completion = EXCLUDED.pricing_completion,
  modality = EXCLUDED.modality,
  capabilities = EXCLUDED.capabilities,
  tags = EXCLUDED.tags,
  is_free = EXCLUDED.is_free,
  top_provider = EXCLUDED.top_provider,
  architecture = EXCLUDED.architecture,
  last_synced_at = EXCLUDED.last_synced_at;

CREATE INDEX IF NOT EXISTS idx_modelos_provider ON cuca.modelos(provider);
CREATE INDEX IF NOT EXISTS idx_modelos_is_free ON cuca.modelos(is_free);
CREATE INDEX IF NOT EXISTS idx_modelos_last_synced_at ON cuca.modelos(last_synced_at DESC);

-- Verificação
SELECT 'public.modelos' AS origem, COUNT(*) AS total FROM public.modelos
UNION ALL
SELECT 'cuca.modelos' AS origem, COUNT(*) AS total FROM cuca.modelos;
