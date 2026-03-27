

## Plano: Campo Agenda no formulário de edição + Label/EventId nas transações

### Resumo

Três ajustes:
1. Adicionar seletor de **agenda** (conta Google Calendar) no formulário de edição de evento
2. Adicionar colunas `google_event_id` e `calendar_label` na tabela `financial_transactions`
3. Gravar esses dois campos em todas as transações criadas pelo faturamento

### 1. Migração de banco de dados

Adicionar duas colunas à tabela `financial_transactions`:

```sql
ALTER TABLE financial_transactions
  ADD COLUMN google_event_id text DEFAULT NULL,
  ADD COLUMN calendar_label text DEFAULT NULL;
```

### 2. Formulário de edição — campo Agenda

**Arquivo:** `src/components/modules/AgendaModule.tsx`

- Adicionar `editAccountId` ao estado `editForm` (inicializado com `evt.accountId` em `handleEditEvent`)
- Renderizar um `Select` com as contas ativas (`activeAccounts`) entre os campos existentes (acima de Data/Hora), exibindo o label de cada conta
- Passar o `editForm.editAccountId` para `updateGoogleEvent` no `handleSaveEdit` (campo `account_id`)
- O campo fica desabilitado (`isDisabled`) nas mesmas condições dos outros campos

### 3. Faturamento — gravar label e event_id

**Arquivo:** `src/components/modules/AgendaModule.tsx` (BillingDialog / `saveMutation`)

- Ao criar transações financeiras (principal, produtos, procedimentos extras), incluir:
  - `google_event_id: event?.id || null`
  - `calendar_label: event?.accountLabel || null`
- Também incluir na transação de cancelamento (`handleCancelEvent`)

### 4. Cancelamento — gravar label e event_id

Na função `handleCancelEvent`, ao inserir a transação de cancelamento, adicionar os dois novos campos.

### Detalhes Técnicos

- A coluna `google_event_id` já existe em `appointments` mas não em `financial_transactions` — a migração adiciona essa redundância necessária para consulta direta no módulo financeiro
- `calendar_label` é texto livre (ex: "Agenda Principal"), derivado de `accountLabel` do `MergedEvent`
- Retrocompatível: transações existentes terão `NULL` em ambas as colunas

