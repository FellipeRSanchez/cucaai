-- Adiciona as colunas necessárias se elas não existirem
ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_tamanho INTEGER;
ALTER TABLE cuca.documentos ADD COLUMN IF NOT EXISTS doc_conteudo TEXT;

-- Atualiza o cache do schema do Supabase (recarrega para a API)
NOTIFY pgrst, 'reload schema';
