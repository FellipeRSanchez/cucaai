-- ============================================
-- TABELA: usuarios (schema public)
-- ============================================
-- Execute este arquivo no Supabase SQL Editor
-- para criar a tabela usuarios necessária para o cadastro

CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários vejam seus próprios dados
CREATE POLICY "Usuários podem ver seus próprios dados"
  ON public.usuarios FOR SELECT  USING (auth.uid() = id);

-- Política para permitir inserção durante o cadastro
CREATE POLICY "Permitir inserção durante cadastro"
  ON public.usuarios FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Política para permitir atualização dos próprios dados
CREATE POLICY "Usuários podem atualizar seus próprios dados"
  ON public.usuarios FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);

-- Conceder permissões ao service_role para acessar a tabela usuarios
GRANT SELECT ON public.usuarios TO service_role;
GRANT INSERT ON public.usuarios TO service_role;
GRANT UPDATE ON public.usuarios TO service_role;
GRANT DELETE ON public.usuarios TO service_role;