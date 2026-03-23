

## Exibir Pagamento, Status e Ações nos Resumos Agrupados do Caixa Diário

### Problema
As linhas de resumo (agrupadas por google_event_id) na tabela de transações mostram células vazias para as colunas Pagamento, Status e Ações.

### Solução

**Arquivo: `src/components/modules/FinanceiroModule.tsx`** (linhas 350-352)

Substituir as 3 `<TableCell />` vazias do grupo header por:

1. **Pagamento**: Se todas as transações do grupo usam o mesmo método, exibir esse método. Caso contrário, exibir "Diversos".
2. **Status**: Se todas as transações do grupo têm o mesmo status, exibir um `<Select>` para atualizar em lote. Caso contrário, exibir "Misto".
3. **Ações**: Exibir botões de expandir/editar a primeira transação e excluir o grupo (ou a primeira transação).

A lógica será derivada das transações já disponíveis em `group.txs` — sem consultas adicionais ao banco.

### Detalhes Técnicos

No bloco do group header row (linhas ~327-353):

- Coluna Pagamento: calcular `commonPayment` a partir de `group.txs` — se todos iguais, mostrar `paymentMethods[method]`; senão, "Diversos"
- Coluna Status: calcular `commonStatus` — se todos iguais, renderizar o mesmo `<Select>` usado em `renderTxRow` mas aplicando `updateStatusMutation` a todas as txs do grupo; senão, badge "Misto"
- Coluna Ações: botões Edit (abre a primeira tx) e Trash (exclui a primeira tx), idênticos aos das linhas individuais

