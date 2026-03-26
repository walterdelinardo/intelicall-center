

## Registrar alertas do bot enviados pelo n8n como notificações

### Contexto
O n8n envia mensagens via node Telegram e retorna um JSON com o resultado (`ok`, `result.message_id`, `result.chat`, `result.text`, etc.). O objetivo é criar uma action `n8n_telegram_log` no `telegram-webhook` que receba esse JSON e registre como notificação outgoing, e adicionar um cURL copiável na UI de configuração dos bots.

### Alterações

**1. Edge Function `supabase/functions/telegram-webhook/index.ts`**
- Adicionar nova action `n8n_telegram_log` que aceita o JSON exato do output do node Telegram do n8n
- Extrai `result.chat.id` para encontrar o bot correspondente (pelo `chat_id`)
- Extrai `result.text` como mensagem
- Registra na `telegram_notifications` como `direction: "outgoing"`, `notification_type: "n8n_message"`
- Armazena o JSON completo no campo `metadata`

**2. Frontend `src/components/settings/TelegramBotsSection.tsx`**
- Adicionar um novo bloco de cURL na seção de integração (sempre visível, não depende de webhook toggle)
- O cURL envia um POST com o body `{ "action": "n8n_telegram_log", "clinicId": "...", "payload": {{ $json }} }` - formato que o n8n entende para injetar o output do node anterior
- Mostrar o Terminal button para todos os bots (não apenas os que têm webhook_financial ou stock ativo)

### Formato do cURL para n8n
```
curl -X POST \
  <webhook-url> \
  -H "Content-Type: application/json" \
  -d '{
    "action": "n8n_telegram_log",
    "clinicId": "<clinic_id>",
    "payload": {{ $json }}
  }'
```
O `{{ $json }}` é a sintaxe do n8n para injetar o output do node anterior (o node Telegram).

### Arquivos
- `supabase/functions/telegram-webhook/index.ts` — nova action
- `src/components/settings/TelegramBotsSection.tsx` — novo cURL + mostrar botão Terminal para todos os bots

