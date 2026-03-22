

## Plano: Auto-refresh + Status de leitura nas notificações

### 1. Migration: adicionar coluna `is_read` na tabela `calendar_notifications`
```sql
ALTER TABLE public.calendar_notifications ADD COLUMN is_read boolean NOT NULL DEFAULT false;
CREATE INDEX idx_calendar_notifications_unread ON public.calendar_notifications(clinic_id, is_read) WHERE is_read = false;
```

### 2. AgendaModule.tsx - Auto-refresh ao trocar de aba
- Quando `agendaTab` mudar para `"calendario"`, chamar `fetchGoogleEvents()` + `syncChanges()`
- Quando mudar para `"notificacoes"`, chamar `refetchNotifications()`
- Adicionar `useEffect` que observa `agendaTab`
- Na aba notificações: badge mostra apenas contagem de `notifications.filter(n => !n.is_read).length`
- Adicionar botão "Marcar como lida" / "Importante" em cada notificação (toggle `is_read`)

### 3. DashboardHeader.tsx - Ícone de notificações inteligente
- Alterar query para buscar notificações e filtrar não lidas para contagem
- Se `unreadCount > 0`: circulo vermelho com número
- Se `unreadCount === 0`: circulo verde com ✓
- Adicionar botão de "marcar como lida" em cada notificação no popover
- Adicionar botão "Marcar todas como lidas" no header do popover

### 4. Notificação individual - botões de ação
- Cada notificação terá dois botões pequenos:
  - **Lida/Não lida** (toggle): atualiza `is_read` no banco
  - Visual: notificações não lidas com fundo levemente destacado, lidas com opacidade reduzida

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | `ADD COLUMN is_read boolean DEFAULT false` + índice |
| `AgendaModule.tsx` | Auto-refresh por aba, badge de não lidas, botões de lida |
| `DashboardHeader.tsx` | Contagem de não lidas, circulo verde/vermelho, botão marcar como lida |

