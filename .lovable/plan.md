

## Plano: Bloqueio de agendamento passado, botões de edição/cancelamento, e URL do local

### 1. Migração: Adicionar `location_url` à tabela `clinics`
- `ALTER TABLE clinics ADD COLUMN location_url text;`

### 2. `ConfiguracoesModule.tsx` — Campo URL do Local na aba Dados Gerais
- Adicionar `location_url` ao form state e ao `useEffect` que popula o form
- Adicionar campo Input com ícone `MapPin` e placeholder "https://maps.google.com/..." após o campo Endereço
- Incluir `location_url` no `updateClinicMutation`

### 3. `AgendaModule.tsx` — Bloqueio de criação no passado
- No `handleCreate`, validar que `${form.date}T${form.start_time}` em GMT-3 não seja anterior a `now()`. Se for, exibir `toast.error("Não é possível agendar no passado")` e retornar
- No `handleSlotClick`, não abrir o dialog se o slot for no passado

### 4. `AgendaModule.tsx` — Eventos futuros: botão "Habilitar Edição" e "Cancelar Evento"
- Eventos futuros abrem inicialmente em modo **somente leitura** (campos desabilitados)
- Botão "Habilitar Edição" no header libera os campos para edição
- Substituir "Excluir" por "Cancelar Evento" com ícone diferente
- AlertDialog de confirmação: "Tem certeza que deseja cancelar este evento? Esta ação não pode ser desfeita."

### 5. Edge function `google-calendar-events` — Incluir `location` no create/update
- Buscar `location_url` da tabela `clinics` via `clinic_id` do perfil do usuário
- Incluir `location: location_url` no body enviado à API do Google Calendar nas ações `create` e `update`
- Na listagem, retornar `location` de cada evento

### 6. `useGoogleCalendar.ts` — Propagar `location`
- Adicionar `location?: string` ao tipo `CalendarEvent`

### Arquivos alterados
- Migração SQL (nova coluna `location_url`)
- `src/components/modules/ConfiguracoesModule.tsx` (campo URL do Local)
- `src/components/modules/AgendaModule.tsx` (validação passado, modo leitura com habilitar edição, cancelar evento)
- `supabase/functions/google-calendar-events/index.ts` (location no create/update/list)
- `src/hooks/useGoogleCalendar.ts` (tipo location)

