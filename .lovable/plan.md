

## Plano: Estoque com integração financeira, saída de itens, produtos com valor de venda e venda de itens no faturamento da agenda

### Resumo
Várias melhorias no módulo de Estoque e integração com Financeiro e Agenda.

---

### 1. Migração de banco — adicionar `sale_price` ao `stock_items`

```sql
ALTER TABLE public.stock_items ADD COLUMN sale_price numeric DEFAULT 0;
```

Necessário para armazenar o valor de venda de itens com categoria "produto".

---

### 2. `EstoqueModule.tsx` — Mudanças

**a) Adicionar "produto" à lista de categorias:**
```
const CATEGORIES = ["geral", "descartáveis", "instrumentos", "químicos", "higiene", "produto", "outros"];
```

**b) Formulário de cadastro/edição:**
- Adicionar `sale_price` ao form (padrão "0")
- Quando `category === "produto"`, exibir campo "Valor de Venda (R$)" e mostrar o percentual de lucro calculado: `((sale_price - cost_price) / cost_price * 100).toFixed(1)%`
- Remover `min="0"` do campo Quantidade (permitir estoque negativo)

**c) Ao salvar novo item (não edição):**
- Após inserir o item com sucesso, criar uma transação financeira:
  - `type: "despesa"`
  - `category: form.category === "produto" ? "produto" : "material"`
  - `description: form.name`
  - `amount: quantity * cost_price`
  - `status: "pendente"`
  - `date: hoje`

**d) Botão "Saída" na tabela:**
- Adicionar botão com ícone `Minus` ou `LogOut` em cada linha
- Ao clicar, abrir dialog com:
  - Quantidade de saída (number input, sem restrição de mínimo no estoque)
  - Tipo de saída: Select com "Uso interno" | "Venda"
  - Se "Venda": gerar `financial_transaction` com `type: "receita"`, `category: "produto"`, `description: item.name`, `amount: quantidade * sale_price`, `status: "pendente"`
  - Se "Uso interno": apenas debitar a quantidade, sem transação financeira
- Atualizar `quantity` do item: `quantity - saída`

**e) Tabela — coluna extra:**
- Para itens com categoria "produto", mostrar `Venda: R$ X.XX` na coluna de Custo ou adicionar coluna Valor Venda

---

### 3. `AgendaModule.tsx` — BillingDialog com venda de itens e procedimentos extras

**Adicionar ao BillingDialog:**

**a) Seção "Itens de Venda":**
- Buscar `stock_items` da clínica (query)
- Campo de busca/seleção (Combobox/Popover) para escolher item
- Campo de quantidade e valor editável (pré-preenchido com `sale_price`)
- Lista de itens adicionados com botão remover
- Ao salvar, para cada item vendido:
  - Criar transação financeira separada com `type: "receita"`, `category: "produto"`, `description: item.name`
  - Debitar quantidade do `stock_items`

**b) Seção "Procedimentos Adicionais":**
- Botão "+ Adicionar Procedimento"
- Campo de busca/seleção dos procedimentos cadastrados
- Campo valor editável (pré-preenchido com `price` do procedimento)
- Lista de procedimentos adicionados com botão remover

**c) Valor total:**
- Somar: valor do procedimento principal + itens de venda + procedimentos adicionais
- Exibir total no formulário

---

### 4. Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `stock_items` (migração) | Adicionar coluna `sale_price` |
| `src/components/modules/EstoqueModule.tsx` | Categoria "produto", campo venda, saída de itens, transação financeira na entrada |
| `src/components/modules/AgendaModule.tsx` | BillingDialog com itens de venda e procedimentos extras |

