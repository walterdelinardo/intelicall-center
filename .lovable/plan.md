

## Plano: Vincular appointments ao Google Calendar via `google_event_id`

### Problema atual
Quando o faturamento cria um appointment local a partir de um evento do Google Calendar, ele não armazena o ID do evento Google. Isso impossibilita:
- Identificar qual appointment pertence a qual evento Google
- Verificar duplicidade de faturamento de forma confiável (hoje usa description + date, que é frágil)
- Vincular transações financeiras e procedimentos extras ao evento correto

### Mudanças

#### 1. Migration: adicionar coluna `google_event_id`
```sql
ALTER TABLE public.appointments ADD COLUMN google_event_id text;
CREATE INDEX idx_appointments_google_event_id ON public.appointments(google_event_id);
```

#### 2. AgendaModule.tsx - BillingDialog
- Ao criar o appointment principal (linha 1745), incluir `google_event_id: event.id`
- Atualizar a verificação de duplicidade (linha 1257) para usar `google_event_id` em vez de comparar description + date:
  ```typescript
  // Antes: compara description e date (frágil)
  // Depois: verifica se já existe appointment com esse google_event_id
  const { data: existing } = await supabase
    .from("appointments")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("google_event_id", editingEvent.id)
    .limit(1);
  ```

#### 3. AgendaModule.tsx - Transações extras
- Vincular as transações de procedimentos extras ao `appointment_id` do extra (hoje estão sem vínculo, linha 1842-1853):
  ```typescript
  // Para cada extra procedure, guardar o appointment_id retornado e vincular à transação
  ```

#### 4. AgendaModule.tsx - mergedEvents
- Filtrar appointments filhos (`parent_appointment_id IS NOT NULL`) do grid para não duplicar visualmente

#### 5. Interface Appointment
- Adicionar `google_event_id?: string` e `parent_appointment_id?: string` à interface

#### 6. Atualizar dados de hoje no banco
- Buscar os eventos do Google Calendar de hoje via edge function
- Fazer UPDATE nos appointments existentes de hoje para preencher `google_event_id` com o ID correto, cruzando por `date + start_time + client name`

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | `ADD COLUMN google_event_id text` + índice |
| `AgendaModule.tsx` | Gravar `google_event_id` no billing; verificação de duplicidade; vincular transações extras; filtrar filhos do grid |

