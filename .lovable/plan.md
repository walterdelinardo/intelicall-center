

## Plano: Cor do calendário no módulo Configurações e Agenda

### Resumo
Adicionar um seletor de cor por conta Google Calendar no módulo Configurações. A cor padrão vem do Google Calendar (`backgroundColor`). Quando o usuário muda a cor, ela é salva localmente e também atualizada no Google Calendar via API. Essas cores são usadas no módulo Agenda para diferenciar visualmente as agendas.

### 1. Migração — adicionar coluna `color` na tabela `google_calendar_accounts`
```sql
ALTER TABLE public.google_calendar_accounts ADD COLUMN color text DEFAULT NULL;
```

### 2. Edge function `google-list-calendars` — já retorna `backgroundColor`
Já funciona. Nenhuma mudança necessária.

### 3. Edge function `google-calendar-events` — retornar cor da conta junto com eventos
Na listagem de eventos, incluir `account_color: account.color` no retorno de cada evento, para que o frontend saiba a cor de cada agenda.

### 4. Nova edge function `google-update-calendar-color`
- Recebe `account_id` e `color`
- Busca a conta, obtém access token válido
- Chama `PATCH https://www.googleapis.com/calendar/v3/calendarList/{calendarId}` com `{ backgroundColor: color, foregroundColor: "#ffffff" }` para atualizar a cor no Google
- Salva a cor na coluna `color` da tabela `google_calendar_accounts`

### 5. `useGoogleOAuth.ts` — adicionar função `updateColor`
- Salva cor no banco (`google_calendar_accounts.color`)
- Chama a edge function para atualizar no Google Calendar
- Recarrega contas

### 6. `ConfiguracoesModule.tsx` — adicionar seletor de cor na tabela de contas Google
- Nova coluna "Cor" na tabela entre "Agenda" e "Status"
- Seletor com as cores padrão do Google Calendar (palette predefinida)
- Ao selecionar uma agenda, carregar `backgroundColor` e salvar como cor padrão se `color` for null
- Ao mudar a cor, chamar `updateColor`

### 7. `useGoogleCalendar.ts` — propagar `account_color` nos eventos
- Incluir campo `accountColor` no tipo `CalendarEvent`
- Preencher a partir do retorno da edge function

### 8. `AgendaModule.tsx` + `TimeGrid.tsx` + `MonthView.tsx` — usar cores das contas
- No `MergedEvent`, adicionar campo `accountColor?: string`
- Nos componentes de grid, usar `accountColor` como cor de fundo/borda dos eventos Google em vez do azul fixo
- Gerar estilo dinâmico: `style={{ backgroundColor: event.accountColor + '20', borderLeft: '3px solid ' + event.accountColor }}`

### Paleta de cores Google Calendar
```
#7986CB, #33B679, #8E24AA, #E67C73, #F6BF26, #F4511E,
#039BE5, #616161, #3F51B5, #0B8043, #D50000, #795548
```

### Arquivos alterados
- Migração SQL (nova coluna `color`)
- `supabase/functions/google-update-calendar-color/index.ts` (novo)
- `supabase/functions/google-calendar-events/index.ts` (retornar `account_color`)
- `src/hooks/useGoogleOAuth.ts` (função `updateColor`)
- `src/hooks/useGoogleCalendar.ts` (propagar cor)
- `src/components/modules/ConfiguracoesModule.tsx` (seletor de cor)
- `src/components/modules/AgendaModule.tsx` (propagar `accountColor` no MergedEvent)
- `src/components/modules/agenda/TimeGrid.tsx` (usar cor dinâmica)
- `src/components/modules/agenda/MonthView.tsx` (usar cor dinâmica)

