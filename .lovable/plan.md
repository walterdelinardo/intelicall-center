

## Problema
Você não consegue acessar a `service_role` key diretamente, e a `anon` key não tem permissão para ler `whatsapp_conversations` por causa do RLS.

## Solução
Criar uma edge function `n8n-query` que funciona como "proxy seguro" para o N8N consultar dados. O N8N chama essa function via HTTP Request, e ela retorna os dados usando acesso administrativo interno.

### Edge Function: `supabase/functions/n8n-query/index.ts`

- **Método**: POST
- **Body**: `{ "table": "whatsapp_conversations", "filters": {} }`
- **Autenticação**: Validar via um secret `N8N_API_SECRET` no header `x-api-secret`
- **Tabelas permitidas**: whitelist (`whatsapp_conversations`, `whatsapp_messages`, `whatsapp_inboxes`)
- **Resposta**: JSON com os dados da tabela

### Configuração
1. Criar a edge function
2. Adicionar um secret `N8N_API_SECRET` (uma senha que você define)
3. No N8N, usar HTTP Request node:
   - URL: `https://nlpnfkidnixphnlwhrux.supabase.co/functions/v1/n8n-query`
   - Header: `x-api-secret: <sua_senha>`
   - Body: `{ "table": "whatsapp_conversations" }`

### Segurança
- Whitelist de tabelas (não permite consultar qualquer tabela)
- Secret compartilhado entre N8N e a function
- Sem exposição da service role key

