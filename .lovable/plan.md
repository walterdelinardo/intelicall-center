

## Materiais do Procedimento e Uso Interno no Faturamento

### Resumo
Ao abrir o diálogo de faturamento, carregar automaticamente os materiais vinculados ao procedimento (da tabela `procedure_materials`). Exibir com quantidade editável. Permitir adicionar materiais extras de uso interno. Nenhum dos dois grupos gera cobrança ao cliente -- ambos apenas descontam do estoque.

### Alterações em `src/components/modules/AgendaModule.tsx` (BillingDialog)

**1. Novo estado e interface**
- Interface `MaterialItem { stockId: string; name: string; qty: number; unit: string }`
- Estado `procedureMaterials: MaterialItem[]` (carregados do cadastro do procedimento)
- Estado `internalMaterials: MaterialItem[]` (adicionados manualmente)
- Estado `showInternalPicker` e `internalSearch`

**2. Nova query: buscar materiais do procedimento**
- Quando o dialog abrir e `ep?.procedureName` existir, resolver o `procedure_id` via query na tabela `procedures`
- Buscar `procedure_materials` com join em `stock_items` (nome, unidade) filtrando pelo `procedure_id`
- Popular `procedureMaterials` no `useEffect` de inicialização

**3. Nova seção UI: "Materiais do Procedimento"**
- Posicionar entre "Valor Principal / Data" e "Venda de Itens"
- Cada linha: nome (truncado), input de quantidade editável, unidade, botão remover
- Icone `Package` no label
- Subtítulo discreto: "Descontados do estoque, sem cobrança"

**4. Nova seção UI: "Material de Uso Interno"**
- Logo abaixo dos materiais do procedimento
- Mesmo layout: lista com nome, qty editável, unidade, botão remover
- Botão "Adicionar Material" com picker do estoque (mesmo padrão do picker de venda)
- Subtítulo: "Materiais extras, descontados do estoque, sem cobrança"

**5. Cálculo do total: sem alteração**
- `grandTotal` continua sendo `baseAmount + itemsTotal + procsTotal`
- Materiais do procedimento e internos NÃO entram no cálculo

**6. No `saveMutation`: descontar estoque**
- Após as transações financeiras existentes, iterar `[...procedureMaterials, ...internalMaterials]`
- Para cada item, buscar a quantidade atual do `stock_items` e fazer `update quantity = quantity - item.qty`
- NÃO criar `financial_transaction` para esses itens

**7. Import adicional**
- Adicionar `Package` ao import do lucide-react (já existe no projeto)

