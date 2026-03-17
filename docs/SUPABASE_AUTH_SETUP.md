# Configuração de Autenticação no Supabase

## Erro 500 no Cadastro

Se você está recebendo erro 500 ao tentar criar uma conta, verifique as seguintes configurações no painel do Supabase:

### 1. Verificar Provedor de Email

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Authentication** > **Providers**
4. Verifique se **Email** está habilitado (toggle deve estar ligado)

### 2. Verificar Confirmação de Email

1. Vá em **Authentication** > **Settings**
2. Verifique a opção **Enable email confirmations**
3. Se estiver habilitada, o usuário precisa confirmar o email antes de fazer login
4. Para testes, você pode desabilitar esta opção temporariamente

### 3. Verificar Configurações de Senha

1. Vá em **Authentication** > **Settings**
2. Verifique **Minimum password length** (deve ser pelo menos 6)
3. Verifique se não há outras restrições de senha muito rígidas

### 4. Verificar Rate Limiting

1. Vá em **Authentication** > **Rate Limits**
2. Verifique se não há limites muito baixos para tentativas de cadastro
3. Para testes, você pode aumentar os limites

### 5. Verificar URLs de Redirecionamento

1. Vá em **Authentication** > **URL Configuration**
2. Adicione `http://localhost:3000` em **Redirect URLs** para desenvolvimento
3. Adicione sua URL de produção quando fizer deploy

### 6. Verificar Logs do Supabase

1. Vá em **Logs** > **Auth Logs**
2. Procure por erros relacionados ao cadastro
3. Os logs mostrarão detalhes específicos do erro 500

## Testando o Cadastro

Após verificar as configurações acima:

1. Tente criar uma conta com um email válido
2. Use uma senha com pelo menos 6 caracteres
3. Verifique o console do navegador para erros detalhados

## Solução Comum

Na maioria dos casos, o erro 500 ocorre porque:
- O provedor de Email não está habilitado
- A confirmação de email está habilitada mas não configurada corretamente
- Há restrições de senha muito rígidas

Desabilitar temporariamente a confirmação de email geralmente resolve o problema para desenvolvimento.