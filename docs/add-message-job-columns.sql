-- Migration: Add background job tracking columns to mensagens
-- Run this in the Supabase SQL Editor

ALTER TABLE cuca.mensagens
  ADD COLUMN IF NOT EXISTS men_status TEXT NOT NULL DEFAULT 'done',
  ADD COLUMN IF NOT EXISTS men_job_id TEXT;

-- Index for fast polling lookups
CREATE INDEX IF NOT EXISTS idx_mensagens_job_id
  ON cuca.mensagens(men_job_id)
  WHERE men_job_id IS NOT NULL;

-- Optional: Mark all existing messages as done
UPDATE cuca.mensagens SET men_status = 'done' WHERE men_status IS NULL;
