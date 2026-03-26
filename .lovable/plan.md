

## Problema

A edge function `telegram-webhook` atual só aceita chamadas manuais com `action: "receive_message"` e `clinicId` no body. Ela **não** está registrada como webhook no Telegram, então quando você envia uma mensagem ao bot, o Telegram não sabe para onde encaminhar — a mensagem simplesmente se perde.

## Solução

### 1. Atualizar a edge function `telegram-webhook` para aceitar o formato nativo do Telegram

Quando o Telegram envia um update via webhook, o body tem o formato `{ update_id, message: { chat: { id }, text, from } }` — sem `action` nem `clinicId`. A function precisa detectar esse formato e:
- Extrair o `chat_id` do update
- Buscar na tabela `telegram_bots` qual bot tem aquele `chat_id` (independente de `clinicId`)
- Inserir a notificação na `telegram_notifications`

A lógica existente (actions `stock_alert`, `financial_report`, `receive_message`) continua funcionando normalmente.

### 2. Adicionar botão "Registrar Webhook" na seção de bots

No `TelegramBotsSection.tsx`, adicionar um botão por bot que chama a API do Telegram `setWebhook` apontando para a URL da edge function. Isso é feito via uma nova action `set_webhook` na própria edge function.

### Alterações

**`supabase/functions/telegram-webhook/index.ts`**:
- No início do handler, antes de checar `action`, verificar se o body contém `message.chat.id` (formato nativo Telegram)
- Se sim: buscar bot pelo `chat_id`, inserir notificação, retornar `{ ok: true }`
- Adicionar action `set_webhook` que chama `https://api.telegram.org/bot{token}/setWebhook` com a URL da function
- Adicionar action `remove_webhook` para desregistrar

**`src/components/settings/TelegramBotsSection.tsx`**:
- Adicionar botão "Ativar Webhook" / "Desativar Webhook" na tabela de bots
- Ao clicar, chamar a edge function com `action: "set_webhook"` passando `botId` e `clinicId`

