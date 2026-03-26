

## Sincronizar chat do grupo Telegram via polling

### Problema
O webhook do Telegram não está funcionando (provavelmente por restrições de rede/certificado). Vamos simplificar: em vez de depender de webhook, criar uma edge function que busca as mensagens do grupo via `getUpdates` do Telegram e insere na tabela `telegram_notifications`.

### Abordagem
Criar uma nova edge function `telegram-sync` que:
1. Busca o bot pelo `botId`
2. Chama `getUpdates` na API do Telegram para pegar mensagens recentes
3. Insere mensagens novas na `telegram_notifications` (evitando duplicatas pelo `update_id` no metadata)

No frontend, adicionar um botão **"Sincronizar"** na tabela de bots (TelegramBotsSection) e também na aba de notificações (TelegramNotificationsTab).

### Alterações

**Nova edge function: `supabase/functions/telegram-sync/index.ts`**
- Recebe `botId` no body
- Busca o bot na tabela `telegram_bots` (token, chat_id, clinic_id)
- Chama `https://api.telegram.org/bot{token}/getUpdates` com offset salvo
- Filtra mensagens do `chat_id` configurado
- Insere cada mensagem nova em `telegram_notifications` (verifica duplicata por `update_id` no metadata)
- Salva o último offset no campo metadata ou numa coluna auxiliar

**Migração: adicionar coluna `last_update_offset` na tabela `telegram_bots`**
- `ALTER TABLE telegram_bots ADD COLUMN last_update_offset bigint DEFAULT 0;`

**Arquivo: `src/components/settings/TelegramBotsSection.tsx`**
- Adicionar botão "Sincronizar" (ícone RefreshCw) na coluna de ações de cada bot
- Ao clicar, chama `supabase.functions.invoke("telegram-sync", { body: { botId } })`
- Exibe toast com quantidade de mensagens sincronizadas

**Arquivo: `src/components/modules/conversas/TelegramNotificationsTab.tsx`**
- Adicionar botão "Sincronizar Grupo" no header ao lado do botão Atualizar
- Busca os bots da clínica e chama a sync para cada um com `webhook_receive_messages = true`

### Detalhes técnicos
- A edge function usa `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS
- O `getUpdates` retorna todas as mensagens pendentes; filtramos pelo `chat_id` do bot
- O `last_update_offset` garante que não processamos mensagens já sincronizadas
- Realtime já está configurado na `telegram_notifications`, então novas mensagens aparecem automaticamente na UI

