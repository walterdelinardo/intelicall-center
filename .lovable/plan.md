## Plano: Corrigir eventos passados, adicionar email, e nomes dos clientes

### Problemas identificados

1. **Eventos passados não aparecem**: A edge function `google-calendar-events` usa `timeMin = new Date().toISOString()` na listagem (linha 64), filtrando todos os eventos anteriores ao momento atual.
2. **Campo email ausente**: O formulário de criação e edição de eventos não inclui campo de email, nem salva no `extendedProperties.private`.
3. **Nomes dos clientes vazios na busca**: O `get-clients` retorna dados de uma base externa onde o campo `nome` pode estar vazio para contatos importados do WhatsApp. O nome do WhatsApp fica no campo `"nome-wpp"` (retornado como `nome_wpp` no JS), mas a UI só exibe `c.nome`.

### Mudanças

#### 1. Edge function `google-calendar-events` — Mostrar eventos passados

- Alterar `timeMin` para buscar eventos dos últimos 90 dias (ou desde o início do mês anterior)
- Manter `timeMax` de 30 dias no futuro

#### 2. `AgendaModule.tsx` — Eventos passados como somente leitura

- Ao clicar num evento passado (`startDateTime < now`), abrir o dialog em modo somente leitura:
  - Todos os campos desabilitados
  - Botão "Salvar Evento" e "Excluir" ocultos
  - Campo de "Observações" continua editável com botão dedicado para salvar apenas observações. Mas não permite editar o conteúdo anterior, pode acresentar mais informações mas nao editar as já existentes
- Adicionar campo **Email** no formulário de criação (novo cliente e cliente selecionado) e no formulário de edição
- Adicionar `clientEmail` ao `extendedProperties` enviado ao Google Calendar

#### 3. `useGoogleCalendar.ts` — Adicionar `clientEmail` ao tipo

- Adicionar `clientEmail` em attendees[].email e`CalendarEventExtendedProps`

#### 4. `AgendaModule.tsx` — Corrigir exibição de nomes na busca de clientes

- Na lista de busca e ao selecionar, usar `c.nome || c.nome_wpp || c.whatsapp` como fallback para o nome
- Garantir que o `handleSelectExternalClient` preenche `clientName` com o nome disponível
- Preencher `clientEmail` automaticamente ao selecionar cliente (campo `email` já existe na interface `Client`)

#### 5. `useClients.ts` — Verificar mapeamento de campos

- O campo `"nome-wpp"` no SQL retorna como `nome-wpp` (com hífen) no JSON, mas a interface TypeScript usa `nome_wpp` (com underscore). Corrigir o alias no SQL: `"nome-wpp" AS nome_wpp`

### Arquivos alterados

- `supabase/functions/google-calendar-events/index.ts` (timeMin para incluir passado)
- `src/components/modules/AgendaModule.tsx` (read-only para passados, campo email, fallback de nomes)
- `src/hooks/useGoogleCalendar.ts` (adicionar `clientEmail`)
- `supabase/functions/get-clients/index.ts` (alias correto para `nome_wpp`)