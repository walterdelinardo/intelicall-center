

## Adicionar cURLs GET para consulta de dados (n8n-query) nos Comandos de Integração

### O que será feito

Adicionar uma nova seção **"Consultar Dados (GET)"** no painel de Comandos de Integração do bot, exibindo exemplos de cURL GET para as tabelas mais úteis: `stock_items`, `financial_transactions`, `clients`, `appointments` e `telegram_notifications`. Isso permite ao usuário copiar e usar no n8n para buscar dados via GET.

### Alteração em `src/components/settings/TelegramBotsSection.tsx`

1. Adicionar a URL base do `n8n-query`: `https://{projectId}.supabase.co/functions/v1/n8n-query`

2. Criar funções geradoras de cURL GET para cada tabela relevante, usando query params. Exemplos:
   - **Estoque**: `?table=stock_items&clinic_id={clinicId}&is_active=true`
   - **Financeiro**: `?table=financial_transactions&clinic_id={clinicId}&order=date&ascending=false&limit=50`
   - **Clientes**: `?table=clients&clinic_id={clinicId}&limit=100`
   - **Agendamentos**: `?table=appointments&clinic_id={clinicId}&order=date&ascending=false&limit=50`

3. Adicionar uma nova seção no painel de cURL (sempre visível, como o n8n log) com título "📊 Consultar Dados via GET" e um seletor de tabela, mostrando o cURL correspondente com botão de copiar.

4. O header `x-api-secret` será incluído no cURL como placeholder `<N8N_API_SECRET>` para o usuário preencher.

### Formato do cURL exibido

```text
curl -X GET \
  "https://PROJECT.supabase.co/functions/v1/n8n-query?table=stock_items&clinic_id=UUID&is_active=true" \
  -H "x-api-secret: <N8N_API_SECRET>"
```

