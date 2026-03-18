# Configuração do Storage no Supabase

## Problema Identificado

O erro 500 no upload de arquivos ocorre porque os buckets de storage não estão configurados no Supabase.

## Solução

Execute o arquivo SQL `setup-storage-buckets.sql` no SQL Editor do Supabase:

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Cole o conteúdo do arquivo `docs/setup-storage-buckets.sql`
5. Clique em **Run** para executar

## O que será criado

- Bucket `documents` para upload de documentos
- Bucket `images` para upload de imagens
- Políticas de acesso para permitir upload e visualização

## Verificação

Após executar o SQL, teste o upload de um arquivo na aplicação. O erro 500 deve ser resolvido.

## Nota

Se os buckets já existirem, o SQL não causará erros devido à cláusula `ON CONFLICT (id) DO NOTHING`.