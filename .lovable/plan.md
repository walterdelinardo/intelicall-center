

## Plano: Evento com Procedimento, Cliente e extendedProperties

### Resumo
Reformular o `CreateEventDialog` e `EventDetailsDialog` para incluir seleção de procedimento, busca/criação de cliente, e salvar dados do cliente no `extendedProperties.private` do Google Calendar. O título é auto-composto como "Procedimento - Nome do Cliente".

### 1. `CreateEventDialog.tsx` — Reformular completamente

**Novos campos:**
- **Procedimento**: Select/dropdown com procedimentos ativos da clínica (usa `useQuery` em `procedures` table). Ao selecionar, preenche duração automaticamente (ajusta `endTime` baseado em `duration_minutes`)
- **Cliente**: Combobox com busca. Usa `useClients()` para listar clientes existentes. Campo de busca filtra por nome/whatsapp. Botão "Novo Cliente" expande campos para cadastro inline
- **Campos do cliente** (auto-preenchidos ao selecionar, editáveis): Nome, WhatsApp, Origem do Contato
- **Valor**: Preenchido automaticamente do procedimento, editável
- **Título**: Campo readonly auto-composto = `{procedimento} - {nomeCliente}`
- **Descrição**: Mantém textarea livre para observações
- **Data, Hora início, Hora fim**: Mantém como está

**Interface `onCreateEvent`**: Passa `extendedProperties` junto com os dados existentes

### 2. `EventDetailsDialog.tsx` — Adicionar campos do cliente no modo edição

**Modo visualização**: Exibir procedimento, cliente, whatsapp, origem, valor (lidos do `extendedProperties.private`)

**Modo edição**: Todos os campos editáveis (procedimento select, nome, whatsapp, origem, valor)

**Botões no footer ao editar**:
- "Criar Evento" (quando é novo) / "Salvar" (quando edita)
- "Atualizar Contato" — chama a edge function existente ou atualiza diretamente o contato na base externa

### 3. Edge function `google-calendar-events` — Suportar `extendedProperties`

**Na criação/atualização**: Incluir `extendedProperties.private` no body enviado à API do Google:
```json
{
  "extendedProperties": {
    "private": {
      "clientName": "...",
      "clientWhatsapp": "...",
      "clientOrigin": "...",
      "procedureName": "...",
      "procedureValue": "..."
    }
  }
}
```

**Na listagem**: Retornar `extendedProperties` de cada evento no response para o frontend poder exibir os dados

### 4. `useGoogleCalendar.ts` — Atualizar tipos e passagem de dados

- Adicionar `extendedProperties` ao tipo `CalendarEvent`
- Atualizar `createEvent` e `updateEvent` para aceitar e repassar `extendedProperties`

### 5. Hook `useClients.ts` — Já existe, reusar

Clientes vêm da edge function `get-clients` (base externa PostgreSQL). Campos: `nome`, `whatsapp`, `nome_wpp`, `email`, `data-nasc`.

### Fluxo do usuário

1. Abre "Novo Evento" → seleciona procedimento → duração e valor preenchidos
2. Busca cliente existente ou clica "Novo Cliente" para preencher manualmente
3. Ao selecionar cliente → nome, whatsapp, origem preenchidos automaticamente
4. Título composto automaticamente: "Limpeza de Pele - Maria Silva"
5. Adiciona observações na descrição
6. Clica "Criar Evento" → salva no Google Calendar com `extendedProperties.private`
7. Ao abrir evento existente → vê dados do cliente → pode editar e "Atualizar Contato"

### Arquivos alterados
- `src/components/dashboard/CreateEventDialog.tsx` (reformulação completa)
- `src/components/dashboard/EventDetailsDialog.tsx` (adicionar campos cliente/procedimento)
- `supabase/functions/google-calendar-events/index.ts` (suportar `extendedProperties`)
- `src/hooks/useGoogleCalendar.ts` (tipos e passagem de `extendedProperties`)

