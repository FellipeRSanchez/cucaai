-- Função para busca vetorial (RAG) nos fragmentos de documentos
CREATE OR REPLACE FUNCTION cuca.match_document_chunks(
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
  -- Habilita o uso de busca vetorial (se necessário)
  -- SET LOCAL ivfflat.probes = 10;

  RETURN QUERY
  SELECT
    dc.dch_id,
    dc.dch_documento,
    d.doc_nome,
    dc.dch_texto,
    -- (1 - cosine_distance) = cosine_similarity
    1 - (dc.dch_embedding <=> query_embedding) AS similarity
  FROM cuca.documentos_chunks dc
  JOIN cuca.documentos d ON d.doc_id = dc.dch_documento
  WHERE d.doc_usuario_id = p_usuario_id
    AND 1 - (dc.dch_embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
