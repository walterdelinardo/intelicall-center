

## Plano: Monitoramento automático de mudanças externas no Google Calendar

### Problema
Quando um evento é criado, editado ou cancelado diretamente no Google Calendar (fora do sistema), o sistema não detecta essas mudanças. As notificações só são geradas para ações feitas dentro do app.

### Solução: Polling com Sync Token

O Google Calendar API oferece duas abordagens: **Push Notifications (Webhooks)** e **Polling com Sync Token**. 

- **Push Notifications** requer um domínio verificado no Google e renovação periódica de canais — complexo para manter.
- **Polling com Sync Token** é simples e confiável: o Google retorna um `nextSyncToken` em cada listagem de eventos. Na próxima chamada, passamos esse token e recebemos apenas os eventos que mudaram desde a última verificação.

Recomendo **Polling com Sync Token**, executado automaticamente a cada vez que o usuário abre a Agenda (e opcionalmente em intervalo periódico).

### Mudanças

#### 1. Nova tabela: `google_calendar_sync_state`
Armazena o `sync_token` por conta de calendário para detectar mudanças incrementais.

```sql
CREATE TABLE public.google_calendar_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES google_calendar_accounts(id) ON DELETE CASCADE,
  sync_token text NOT NULL,
  last_synced_at timestamptz DEFAULT now(),
  UNIQUE(account_id)
);
ALTER TABLE public.google_calendar_sync_state ENABLE ROW LEVEL SECURITY;
-- RLS: service_role only (usado pela edge function)
CREATE POLICY "Service role full access" ON public.google_calendar_sync_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### 2. Nova Edge Function: `google-calendar-sync`
- Recebe `account_id` (ou processa todas as contas ativas da clínica)
- Busca o `sync_token` salvo da tabela `google_calendar_sync_state`
- Chama Google Calendar API com `syncToken` para obter apenas mudanças
- Para cada evento retornado:
  - Se `status === 'cancelled'` → registra notificação de **cancelamento**
  - Se evento é novo (não existe no histórico) → registra notificação de **criação externa**
  - Se evento existente foi modificado → registra notificação de **atualização**
- Salva o novo `sync_token` retornado
- Na primeira execução (sem sync_token), faz uma listagem completa para obter o token inicial sem gerar notificações

#### 3. Integração no Frontend (`AgendaModule.tsx`)
- Após cada `fetchEvents()`, chamar a edge function `google-calendar-sync` em background
- As notificações geradas aparecerão automaticamente na aba de Notificações existente
- Opcionalmente, adicionar um intervalo de polling (ex: a cada 2 minutos) enquanto a aba Agenda estiver aberta

#### 4. Lógica de detecção de mudanças

```text
Google Calendar API (syncToken)
         │
         ▼
   Eventos modificados
         │
    ┌────┴────┐
    │         │
 cancelled  updated/created
    │         │
    ▼         ▼
 Notifica   Compara com eventos
 cancelamento  conhecidos
              │
         ┌────┴────┐
         │         │
      Novo      Alterado
         │         │
         ▼         ▼
    Notifica   Notifica
    criação    atualização
    externa    externa
```

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Criar tabela `google_calendar_sync_state` |
| `supabase/functions/google-calendar-sync/index.ts` | Nova edge function de sync incremental |
| `src/components/modules/AgendaModule.tsx` | Chamar sync após fetchEvents |
| `src/hooks/useGoogleCalendar.ts` | Adicionar método `syncChanges()` |

