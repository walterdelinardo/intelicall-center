

## Correção do Sistema de Notificações da Agenda

### Problemas Identificados

1. **Duplicação de notificações**: Quando um evento é criado internamente, o sistema registra uma notificação local (`action: "created"`) e logo em seguida o `syncChanges()` detecta o mesmo evento como novo no Google Calendar, gerando uma segunda notificação (`action: "created_external"`).

2. **Não diferencia criação vs atualização**: O sync verifica a tabela `appointments` para decidir, mas eventos criados internamente podem não ter o `google_event_id` salvo a tempo.

3. **Ícones diferentes para ações externas**: As ações externas (`created_external`, `updated_external`, `cancelled_external`) não existem no mapa de ícones, caindo no fallback "📋".

### Solução

#### 1. Edge Function `google-calendar-sync/index.ts` — Unificar ações e evitar duplicatas

- Mudar as ações de `created_external` / `updated_external` / `cancelled_external` para `created` / `updated` / `cancelled` (mesmos nomes das ações internas).
- Antes de inserir uma notificação, verificar se já existe uma notificação recente (últimos 2 minutos) para o mesmo `event_title` + `action` + `clinic_id`, evitando a duplicata quando o sistema interno e o sync rodam quase simultaneamente.
- Para distinguir criação de atualização: verificar tanto a tabela `appointments` quanto a tabela `calendar_notifications` — se já existir uma notificação `created` para aquele `event_id`, tratar como `updated`.

#### 2. Mapas de ícones (`DashboardHeader.tsx` e `AgendaModule.tsx`)

- Nenhuma alteração necessária após a unificação dos nomes de ações, pois as ações externas passarão a usar os mesmos nomes (`created`, `updated`, `cancelled`, `rescheduled`).

### Arquivos Alterados

- `supabase/functions/google-calendar-sync/index.ts` — lógica de deduplicação e unificação de action names

### Detalhes Técnicos

Na edge function `google-calendar-sync`, para cada evento detectado:

1. Determinar a ação correta: se `event.status === 'cancelled'` → `cancelled`; se existe notificação prévia com esse `event_id` ou appointment com esse `google_event_id` → `updated`; senão → `created`.
2. Antes de inserir, checar se existe notificação com mesmo `event_title`, `clinic_id` e `action` nos últimos 2 minutos — se sim, pular (é duplicata do registro interno).
3. O campo `actor_name` continua usando `event.creator?.email` para ações externas, diferenciando visualmente quem fez a ação.

