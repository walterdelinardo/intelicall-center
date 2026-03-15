

## Plano: Selecionar agenda específica após conectar conta Google

### Problema atual
Quando o usuário conecta via OAuth, o sistema salva `calendar_id: 'primary'` fixo. O usuário quer conectar a conta Google primeiro e depois escolher qual das suas agendas (calendários) sincronizar.

### Fluxo proposto

```text
1. Conectar conta Google (OAuth) → salva tokens com calendar_id='primary'
2. Após conectar, buscar lista de calendários do usuário via API
3. Exibir seletor de calendário na tabela de contas (dropdown)
4. Salvar o calendar_id escolhido na google_calendar_accounts
```

### Mudanças

#### 1. Nova Edge Function `google-list-calendars`
- Recebe `account_id` no body
- Busca tokens da conta em `google_calendar_accounts`
- Chama `https://www.googleapis.com/calendar/v3/users/me/calendarList` com o access token
- Retorna lista `[{ id, summary, primary, backgroundColor }]`

#### 2. Atualizar `useGoogleOAuth` hook
- Adicionar método `fetchCalendars(accountId)` que chama a nova edge function
- Adicionar método `updateCalendarId(accountId, calendarId)` que atualiza o `calendar_id` na tabela
- Interface `GoogleCalendarAccount` já tem `calendar_id`

#### 3. Atualizar `ConfiguracoesModule.tsx` — tabela de contas Google
- Para contas OAuth (não iCal), adicionar coluna "Agenda" com um dropdown/select
- Ao expandir/clicar, busca calendários disponíveis via `fetchCalendars`
- Usuário seleciona a agenda desejada → salva `calendar_id` na conta
- Mostrar o nome da agenda selecionada na tabela (em vez de apenas "OAuth")

#### 4. Nenhuma mudança no `google-calendar-events`
Já usa `account.calendar_id` para todas as operações — funciona automaticamente com qualquer calendar_id.

### Detalhes técnicos
- A API `calendarList` retorna todos os calendários visíveis para o usuário (próprios + compartilhados)
- O `calendar_id` pode ser um email (ex: `user@gmail.com`) ou um ID longo para calendários secundários
- A edge function reutiliza a lógica de `getValidAccessToken` para refresh automático

