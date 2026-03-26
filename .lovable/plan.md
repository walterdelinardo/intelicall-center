

## Simplificar: remover webhook, manter apenas sync por polling

### O que mudar

**`src/components/settings/TelegramBotsSection.tsx`**
- Remover o botão de Webhook (ícone Webhook/link) da coluna de ações
- Remover a função `handleSetWebhook` e o state `webhookLoading`
- Manter apenas o botão Sincronizar (RefreshCw), Ativar/Desativar (Power) e Excluir (Trash2)

**`supabase/functions/telegram-webhook/index.ts`**
- Remover as actions `set_webhook` e `remove_webhook`
- Remover o handler de updates nativos do Telegram (bloco que detecta `body.update_id && body.message`)
- Manter apenas as actions existentes: `receive_message`, `financial_report`, `stock_alert`, `send_message`

O fluxo fica simples: o usuário clica "Sincronizar" no bot ou na aba de notificações → chama `telegram-sync` → busca mensagens via `getUpdates` → insere na `telegram_notifications` → aparece na aba Conversas.

