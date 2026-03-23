

## Adicionar Número e Complemento em Clínica e Clientes + Reorganizar campos

### Migração SQL
Adicionar colunas em ambas as tabelas:
```sql
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS address_complement TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_complement TEXT;
```

### ConfiguracoesModule.tsx
1. Adicionar `address_number` e `address_complement` ao estado `form` e ao `useEffect` de carregamento
2. Incluir no `updateClinicMutation`
3. Reorganizar layout de endereço:
   - Linha 1: CEP (1 col, onBlur ViaCEP)
   - Linha 2: Logradouro (2 cols) | Numero (1 col) | Complemento (1 col)
   - Linha 3: Bairro (1 col) | Cidade (1 col) | Estado (1 col)
4. Alterar placeholder do Logradouro de "Rua, número, complemento" para "Logradouro"

### ClientesModule.tsx
1. Adicionar `address_number` e `address_complement` ao `emptyForm`
2. Incluir no `openEdit` e no `saveMutation`
3. Adicionar campos Número e Complemento no formulário, após Endereço
4. Reorganizar campos: CEP → Endereço → Número → Complemento → Bairro → Cidade → Estado

### ClientDetailsDialog.tsx
- Incluir número e complemento no endereço formatado

### Arquivos afetados
- Nova migração SQL
- `src/components/modules/ConfiguracoesModule.tsx`
- `src/components/modules/ClientesModule.tsx`
- `src/components/modules/clients/ClientDetailsDialog.tsx`

