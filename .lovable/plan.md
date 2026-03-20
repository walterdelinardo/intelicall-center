

## Diagnóstico: Lançamentos financeiros duplicados ao faturar eventos

### Bugs encontrados

Há **duas fontes de duplicação** no fluxo de faturamento:

**Bug 1 — Trigger `auto_generate_transaction` cria transação duplicada:**
- O código insere o appointment principal com `status: "compareceu"` (linha 1752)
- O trigger `auto_generate_transaction` detecta esse status e cria automaticamente uma transação com o valor do procedimento
- Logo depois, o código do faturamento cria OUTRA transação manualmente (linha 1798)
- Resultado: **2 transações para o procedimento principal**

**Bug 2 — `grandTotal` inclui tudo, mas extras e produtos também geram transações individuais:**
- A transação principal usa `grandTotal` (base + extras + produtos) na linha 1803
- Depois, cada procedimento extra gera sua própria transação individual (linhas 1836-1848)
- Cada produto gera sua própria transação individual (linhas 1814-1825)
- Resultado: **extras e produtos são contados 2x** (uma vez no grandTotal, outra vez individualmente)

**Bug 3 — Extra procedures também disparam o trigger:**
- Appointments extras são inseridos com `status: "compareceu"` (linha 1790)
- O trigger cria transações automáticas para cada um
- O código também cria transações manuais para cada um
- Resultado: **2 transações por procedimento extra**

### Exemplo concreto do usuário
Evento com procedimento principal R$100 + procedimento extra R$50:
- Trigger cria: R$100 (principal) + R$50 (extra) = 2 transações
- Código cria: R$150 (grandTotal) + R$50 (extra individual) = 2 transações
- **Total: 4 transações em vez de 2**

---

### Correção proposta

**Arquivo**: `src/components/modules/AgendaModule.tsx` (função `BillingDialog.saveMutation`)

1. **Inserir appointments com status `"confirmado"` em vez de `"compareceu"`** — evita que o trigger dispare
2. **Transação principal usa `baseAmount`** (só o procedimento principal), **não `grandTotal`**
3. Manter as transações individuais para extras e produtos (já existem)
4. **Após criar todas as transações**, atualizar os appointments para `status: "compareceu"` — o trigger verifica `NOT EXISTS` e não duplica

Mudanças específicas no código:

| Linha | Atual | Corrigido |
|-------|-------|-----------|
| 1752 | `status: "compareceu"` | `status: "confirmado"` |
| 1790 | `status: "compareceu"` | `status: "confirmado"` |
| 1803 | `amount: grandTotal` | `amount: baseAmount` |
| Novo (após linha 1848) | — | `UPDATE` todos os appointments criados para `status: "compareceu"` |

Isso garante:
- 1 transação para o procedimento principal (baseAmount)
- 1 transação por procedimento extra (preço individual)
- 1 transação por produto vendido (qty × price)
- Sem duplicações do trigger

