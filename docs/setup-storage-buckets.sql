-- ============================================
-- CONFIGURAÇÃO DOS BUCKETS DE STORAGE
-- ============================================
-- Execute este arquivo no Supabase SQL Editor
-- para criar os buckets necessários para upload

-- Criar bucket para documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Criar bucket para imagens
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir upload de documentos
CREATE POLICY "Permitir upload de documentos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents');

-- Política para permitir visualização de documentos
CREATE POLICY "Permitir visualização de documentos"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- Política para permitir upload de imagens
CREATE POLICY "Permitir upload de imagens"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'images');

-- Política para permitir visualização de imagens
CREATE POLICY "Permitir visualização de imagens"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- Política para permitir exclusão de documentos
CREATE POLICY "Permitir exclusão de documentos"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents');

-- Política para permitir exclusão de imagens
CREATE POLICY "Permitir exclusão de imagens"
ON storage.objects FOR DELETE
USING (bucket_id = 'images');