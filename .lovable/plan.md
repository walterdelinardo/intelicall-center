

## Unificar materiais em uma única seção "Materiais do Procedimento"

### O que muda
Eliminar a seção separada "Material de Uso Interno" e mover o botão "Adicionar Material" para dentro da seção "Materiais do Procedimento". Materiais extras adicionados manualmente ficam na mesma lista, todos descontam do estoque sem cobrança.

### Alterações em `src/components/modules/AgendaModule.tsx`

**1. Unificar estado**: Eliminar `internalMaterials` e `showInternalPicker`/`internalSearch`. Reutilizar `procedureMaterials` para tudo. Renomear os estados do picker para algo genérico (ex: `showMaterialPicker`, `materialSearch`).

**2. Função `addInternalMaterial`**: Passa a fazer `setProcedureMaterials([...procedureMaterials, { ... }])` em vez de usar `setInternalMaterials`.

**3. `filteredInternalStock`**: Filtrar apenas contra `procedureMaterials` (sem referência a `internalMaterials`).

**4. UI**: 
- Remover toda a seção "Material de Uso Interno" (linhas ~2111-2161)
- Na seção "Materiais do Procedimento" (linhas ~2080-2109):
  - Sempre exibir a seção (remover o condicional `procedureMaterials.length > 0`)
  - Mover o botão "Adicionar Material" com o Popover/Command picker para dentro desta seção, após a lista de materiais
  - Alterar subtítulo para: "Descontados do estoque, sem cobrança"

**5. `saveMutation`**: Simplificar para iterar apenas `procedureMaterials` (já que `internalMaterials` não existe mais).

**6. Reset no dialog**: Remover `setInternalMaterials([])` do reset, manter apenas `setProcedureMaterials([])`.

### Resultado
Uma única seção "Materiais do Procedimento" com os materiais importados automaticamente + botão para adicionar extras, todos tratados igualmente para baixa de estoque.

