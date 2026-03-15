# Configuração do Supabase - Cuca AI

## Problema Identificado
O código está funcionando aparentemente, mas **nada está sendo salvo no banco de dados**. Isso geralmente ocorre por:

1. **Tabelas não criadas** no Supabase
2. **Políticas RLS (Row Level Security)** bloqueando as operações
3. **Schema 'cuca'** não existente

## Solução Completa

### 1. Criar o Schema 'cuca'

No Supabase SQL Editor, execute:

```sql
-- Criar schema 'cuca' se não existir
CREATE SCHEMA IF NOT EXISTS cuca;

-- Habilitar RLS (Row Level Security) nas tabelas
-- Isso será feito automaticamente ao criar as tabelas
```

### 2. Criar Tabelas

```sql
-- Tabela de conversas
CREATE TABLE IF NOT EXISTS cuca.conversas (
  con_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  con_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  con_titulo TEXT NOT NULL,
  con_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  con_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS cuca.mensagens (
  men_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  men_conversa_id UUID NOT NULL REFERENCES cuca.conversas(con_id) ON DELETE CASCADE,
  men_papel TEXT NOT NULL CHECK (men_papel IN ('user', 'assistant')),
  men_conteudo TEXT NOT NULL,
  men_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_conversas_usuario ON cuca.conversas(con_usuario_id);
CREATE INDEX IF NOT EXISTS idx_conversas_atualizado ON cuca.conversas(con_atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON cuca.mensagens(men_conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_criado ON cuca.mensagens(men_criado_em ASC);
```

### 3. Configurar Row Level Security (RLS)

```sql
-- Habilitar RLS nas tabelas
ALTER TABLE cuca.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuca.mensagens ENABLE ROW LEVEL SECURITY;

-- Políticas para conversas
CREATE POLICY "Usuários podem ver suas próprias conversas"
  ON cuca.conversas FOR SELECT
  USING (auth.uid() = con_usuario_id);

CREATE POLICY "Usuários podem criar suas próprias conversas"
  ON cuca.conversas FOR INSERT
  WITH CHECK (auth.uid() = con_usuario_id);

CREATE POLICY "Usuários podem atualizar suas próprias conversas"
  ON cuca.conversas FOR UPDATE
  USING (auth.uid() = con_usuario_id)
  WITH CHECK (auth.uid() = con_usuario_id);

CREATE POLICY "Usuários podem deletar suas próprias conversas"
  ON cuca.conversas FOR DELETE
  USING (auth.uid() = con_usuario_id);

-- Políticas para mensagens
CREATE POLICY "Usuários podem ver mensagens de suas conversas"
  ON cuca.mensagens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cuca.conversas
      WHERE con_id = mensagens.men_conversa_id
      AND con_usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar mensagens em suas conversas"
  ON cuca.mensagens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cuca.conversas
      WHERE con_id = mensagens.men_conversa_id
      AND con_usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar mensagens em suas conversas"
  ON cuca.mensagens FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cuca.conversas
      WHERE con_id = mensagens.men_conversa_id
      AND con_usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar mensagens em suas conversas"
  ON cuca.mensagens FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cuca.conversas
      WHERE con_id = mensagens.men_conversa_id
      AND con_usuario_id = auth.uid()
    )
  );
```

### 4. Verificação

Após executar os comandos acima:

1. Acesse o Supabase Dashboard
2. Vá em **Table Editor**
3. Verifique se as tabelas `cuca.conversas` e `cuca.mensagens` existem
4. Teste enviando uma mensagem no chat
5. Verifique se os dados aparecem nas tabelas

### 5. Troubleshooting

#### Verifique os logs do servidor
- Abra o console do navegador (F12)
- Vá na aba "Network" e observe as requisições para `/api/chat`
- Verifique o terminal onde o Next.js está rodando para ver erros

#### Problemas comuns:

**Erro 401 (Unauthorized):** 
- Verifique se você está autenticado
- Verifique se o Supabase Auth está configurado corretamente

**Erro 403 (RLS Policy violation):**
- As políticas RLS não estão configuradas corretamente
- Ou você está tentando acessar dados de outro usuário

**Erro 500:**
- Verifique se o service role key está correta no `.env.local`
- Verifique se o schema 'cuca' existe
- Verifique os logs do servidor para detalhes

#### Teste manual:
Use o `test-api.js` para testar as queries diretamente.