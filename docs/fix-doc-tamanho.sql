-- Adiciona a coluna doc_tamanho se ela não existir
ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_tamanho INTEGER;

-- Atualiza o cache do schema do Supabase (recarrega para a API)
NOTIFY pgrst, 'reload schema';
