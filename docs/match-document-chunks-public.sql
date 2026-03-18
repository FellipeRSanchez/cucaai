-- Movemos a função para o schema public para garantir que o Supabase RPC a encontre facilmente
DROP FUNCTION IF EXISTS cuca.match_document_chunks;

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_usuario_id uuid
)
RETURNS TABLE (
  dch_id uuid,
  dch_documento uuid,
  doc_nome text,
  dch_texto text,
  similaridade float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.dch_id,
    dc.dch_documento,
    d.doc_nome,
    dc.dch_texto,
    1 - (dc.dch_embedding <=> query_embedding) AS similarity
  FROM cuca.documentos_chunks dc
  JOIN cuca.documentos d ON d.doc_id = dc.dch_documento
  WHERE d.doc_usuario_id = p_usuario_id
    AND 1 - (dc.dch_embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
