

## Recomendação: Usar Google Calendar como fonte de verdade

A melhor abordagem é **usar o Google Calendar diretamente via API** — sem duplicar eventos localmente. Motivos:

1. **Evita conflitos de sincronização** — não há dois bancos de dados para manter em sincronia
2. **Alterações aparecem instantaneamente** nos dois lados (app e Google)
3. **Menos complexidade** — não precisa de webhooks, polling ou resolução de conflitos
4. **Já temos a base**: as edge functions `google-calendar-events` já fazem CRUD via API do Google

### Como funciona

```text
App (Agenda) ←→ Edge Functions ←→ Google Calendar API
                                        ↕
                                   Google Calendar (web/mobile)
```

- **Criar/editar/excluir** evento no app → chama a API do Google → evento atualiza em todos os dispositivos
- **Visualizar** eventos → busca direto da API do Google → sempre dados frescos
- A tabela `appointments` local deixa de ser a fonte principal — passa a ser apenas para agendamentos que **não** estão vinculados ao Google

### O que precisa mudar

1. **`AgendaModule.tsx`** — Remover a duplicação. Quando o usuário tem conta Google conectada, os eventos vêm direto da API (já acontece parcialmente). O formulário de criar/editar evento deve chamar `createEvent`/`updateEvent` do hook `useGoogleCalendar` em vez de inserir na tabela `appointments`

2. **`google-calendar-events` edge function** — Já suporta create/update/delete. Apenas garantir que os campos (título, descrição, horário) mapeiam corretamente com o formulário do app

3. **`useGoogleCalendar` hook** — Já tem `createEvent`, `updateEvent`, `deleteEvent`. Precisa conectar esses métodos ao formulário da Agenda

4. **Formulário de criação** — Quando há conta Google ativa, o evento é criado direto no Google Calendar. Adicionar seletor de qual conta usar (para multi-conta)

5. **Cache local** — Usar React Query com `staleTime` de ~30s para evitar chamadas excessivas à API, mas manter dados atualizados

### O que NÃO mudar

- A tabela `appointments` continua existindo para clínicas sem Google Calendar conectado
- O iCal continua funcionando como fonte read-only
- As contas Google Calendar em `google_calendar_accounts` continuam como estão

