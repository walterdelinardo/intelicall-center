

## Plano: Ajustes na Agenda — Faturamento, Cancelamento com motivo, e limpeza de campos

### Mudanças

#### 1. `AgendaModule.tsx` — Remover e ajustar campos/botões

- **Remover** botão "Atualizar Contato" do dialog de edição (linhas 1143-1155)
- **Remover** campo "Origem" ao selecionar cliente existente (linhas 723-736 no create form, e linhas 1071-1084 no edit form). Manter "Origem" apenas no bloco "Novo Cliente" (isNewClient=true)
- **Adicionar** campo "Data de Nascimento" (type="date") no bloco de "Novo Cliente" (após Email, antes de Origem)
- Salvar `clientBirthdate` em `extendedProperties.private`
- **Diminuir área clicável** dos botões "Novo Cliente" / "Buscar existente" — usar `size="sm"` com padding reduzido e `h-auto py-0.5` para que fique compacto

#### 2. Cancelamento com motivo

- Adicionar estado `cancelReason` (string)
- No `AlertDialog` de cancelamento, adicionar campo `Textarea` para "Motivo do cancelamento" (obrigatório)
- Ao confirmar cancelamento:
  1. Deletar evento do Google Calendar (como já faz)
  2. Inserir `financial_transaction` com: type="receita", category="atendimento", description=título do evento, amount=0, status="cancelado", date=data do evento, notes=motivo do cancelamento, clinic_id do perfil

#### 3. Botão "Faturar" em eventos futuros/atuais

- Adicionar estado `isBillingOpen` e `billingEvent` (MergedEvent)
- No dialog de edição de evento (futuro), adicionar botão `<DollarSign> Faturar` no header, ao lado de "Habilitar Edição" e "Cancelar Evento"
- Ao clicar "Faturar", abrir o `TransactionFormDialog` (importar do FinanceiroModule ou duplicar inline) com campos pré-preenchidos:
  - type: "receita"
  - category: "atendimento"
  - status: "pago"
  - description: título do evento
  - amount: `procedureValue` do extendedProperties
  - date: data do evento
  - payment_method: "pix" (editável)
  - notes: "" (editável)

**Abordagem**: Criar um componente `BillingDialog` inline no AgendaModule que replica a lógica do `TransactionFormDialog` do FinanceiroModule, pré-preenchido com dados do evento. Isso evita acoplamento entre módulos.

#### 4. `useGoogleCalendar.ts` — Adicionar `clientBirthdate`

- Adicionar `clientBirthdate?: string` ao tipo `CalendarEventExtendedProps`

### Arquivos alterados
- `src/components/modules/AgendaModule.tsx` (todos os ajustes de UI + faturamento + cancelamento com motivo)
- `src/hooks/useGoogleCalendar.ts` (clientBirthdate no tipo)

