# Convenção de Nomenclatura - Banco de Dados Cuca AI

## Regra Geral

Todas as tabelas e campos devem seguir o padrão: **`prefixo_nome`**

- **Prefixo**: 3 primeiras letras do nome da tabela (minúsculas)
- **Separador**: `_` (underscore)
- **Nome do campo**: nome descritivo em snake_case

## Exemplos

### Tabela `agentes`
| Campo | Nome Correto |
|-------|--------------|
| ID | `age_id` |
| Usuário | `age_usuario_id` |
| Nome | `age_nome` |
| Descrição | `age_descricao` |
| Criado em | `age_criado_em` |

### Tabela `mcp_servers`
| Campo | Nome Correto |
|-------|--------------|
| ID | `mcp_id` |
| Usuário | `mcp_usuario_id` |
| Nome | `mcp_name` |
| URL | `mcp_url` |
| API Key | `mcp_api_key` |
| Habilitado | `mcp_enabled` |
| Criado em | `mcp_criado_em` |

### Tabela `conversas`
| Campo | Nome Correto |
|-------|--------------|
| ID | `con_id` |
| Título | `con_titulo` |
| Criado em | `con_criado_em` |

### Tabela `mensagens`
| Campo | Nome Correto |
|-------|--------------|
| ID | `men_id` |
| Conversa ID | `men_conversa_id` |
| Conteúdo | `men_conteudo` |
| Modelo | `men_modelo` |

### Tabela `documentos`
| Campo | Nome Correto |
|-------|--------------|
| ID | `doc_id` |
| Usuário | `doc_usuario_id` |
| Nome | `doc_nome` |

### Tabela `memorias`
| Campo | Nome Correto |
|-------|--------------|
| ID | `mem_id` |
| Usuário | `mem_usuario_id` |
| Pergunta | `mem_pergunta` |
| Resposta | `mem_resposta` |

## Regras Adicionais

1. **Primary Key**: Sempre `{prefixo}_id`
2. **Foreign Key**: Sempre `{prefixo}_usuario_id` (para referência a usuários)
3. **Timestamps**: Sempre `{prefixo}_criado_em` e `{prefixo}_atualizado_em`
4. **Booleanos**: Sempre `{prefixo}_enabled` ou `{prefixo}_ativo`
5. **Índices**: Sempre `idx_{prefixo}_{campo}`

## SQL de Exemplo

```sql
CREATE TABLE cuca.minha_tabela (
  min_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  min_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  min_nome TEXT NOT NULL,
  min_descricao TEXT,
  min_enabled BOOLEAN DEFAULT true,
  min_criado_em TIMESTAMPTZ DEFAULT now(),
  min_atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE cuca.minha_tabela ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own items"
  ON cuca.minha_tabela FOR SELECT
  USING (auth.uid() = min_usuario_id);

-- Index
CREATE INDEX idx_minha_tabela_usuario_id ON cuca.minha_tabela(min_usuario_id);
```

## Observações

- Sempre usar o schema `cuca` para todas as tabelas
- Todos os campos devem ter o prefixo da tabela
- Foreign keys para `auth.users` devem usar `ON DELETE CASCADE`
- Todos os dados do usuário devem ter RLS habilitado
