

## Plano: Melhorias no Estoque e Faturamento

### 1. `EstoqueModule.tsx` — Saída com valor editável + Botão de Entrada

**a) Dialog de Saída — campo valor de venda editável:**
- Adicionar estado `exitSalePrice` inicializado com `item.sale_price || 0`
- Quando `exitType === "venda"`, mostrar Input editável com o valor de venda (default `0.00` se não tem)
- Usar `exitSalePrice` no cálculo do valor da venda e na criação da transação financeira

**b) Botão de Entrada na tabela:**
- Adicionar ícone `LogIn` (ou `PackagePlus`) ao lado do botão de saída
- Ao clicar, abrir dialog de "Entrada de Estoque" com:
  - Quantidade de entrada
  - Custo unitário (pré-preenchido com `cost_price` do item)
- Ao confirmar: incrementar `quantity` do item e criar transação `despesa` com a mesma lógica de novo item (`category: item.category === "produto" ? "produto" : "material"`, `description: item.name`, `amount: qty * custo`, `status: "pendente"`)

### 2. `AgendaModule.tsx` — Billing dialog: sempre mostrar valor de venda

**Linha 1558** — Alterar exibição do preço no picker de itens:
- Sempre mostrar `sale_price`, se não tem mostrar `0.00`
- Mudar de `s.sale_price || s.cost_price || 0` para `s.sale_price || 0`

**Linha 1373** — `addSaleItem`: 
- Mudar de `item.sale_price || item.cost_price || 0` para `item.sale_price || 0`

### Arquivos alterados
- `src/components/modules/EstoqueModule.tsx`
- `src/components/modules/AgendaModule.tsx`

