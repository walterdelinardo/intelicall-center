

## Mostrar mensagens do bot como notificações

### Contexto
A API `getUpdates` do Telegram **não retorna** mensagens enviadas pelo próprio bot — é uma limitação da plataforma. Porém, as mensagens enviadas pelo sistema (via `telegram-webhook`: send_message, stock_alert, financial_report) **já são gravadas** como notificações "outgoing" na tabela `telegram_notifications`.

O problema pode estar em duas frentes:

### 1. Melhorar o polling para captar mensagens em tempo real
O `telegram-poll` atual faz um poll curto (timeout=0) a cada minuto. Vou atualizar para usar **long polling com loop de 55s**, reduzindo a latência de mensagens recebidas de ~60s para ~0-5s.

### 2. Diferenciar visualmente mensagens do bot (outgoing) na UI
Adicionar estilo visual distinto para mensagens "outgoing" (enviadas pelo bot) vs "incoming" (recebidas de usuários) no `TelegramNotificationsTab`:
- Mensagens outgoing: ícone de envio, badge "Enviado", fundo levemente diferente
- Mensagens incoming: visual atual

### Arquivos a alterar

**`supabase/functions/telegram-poll/index.ts`**
- Implementar loop de polling contínuo por ~55s com timeout dinâmico
- Cada iteração usa long poll (até 50s) para resposta quase instantânea
- Evita sobreposição com o cron de 1 minuto

**`src/components/modules/conversas/TelegramNotificationsTab.tsx`**
- Adicionar visual distinto para notificações com `direction === "outgoing"` (ícone de envio, badge "Enviado pelo Bot", cor de fundo diferenciada)
- Garantir que ambas as direções sejam exibidas claramente

### Resultado
- Mensagens de usuários no grupo: captadas automaticamente em tempo real via long polling
- Mensagens do bot (alertas, relatórios, mensagens enviadas pelo sistema): já gravadas e agora exibidas com visual distinto
- Mensagens enviadas diretamente pelo Telegram (fora do sistema): limitação da API, não é possível captar

