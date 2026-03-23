

## Adicionar campo Bairro e auto-preenchimento por CEP

### Resumo
Adicionar o campo "Bairro" (neighborhood) nas tabelas `clinics` e `clients`, e implementar busca automática via API ViaCEP quando o CEP é informado, preenchendo Logradouro, Bairro, Cidade e Estado automaticamente. Campos "Número" e "Complemento" não existem separados atualmente — o campo "Endereço" atual será mantido como logradouro.

---

### Migração SQL
Adicionar coluna `neighborhood` em ambas as tabelas:
```sql
ALTER TABLE public.clinics ADD COLUMN neighborhood TEXT;
ALTER TABLE public.clients ADD COLUMN neighborhood TEXT;
```

### Lógica de auto-preenchimento (ViaCEP)
Criar uma função utilitária reutilizável que:
1. Ao digitar/colar um CEP com 8 dígitos (ou formato 00000-000), chama `https://viacep.com.br/ws/{cep}/json/`
2. Com a resposta, preenche automaticamente: `address` (logradouro), `neighborhood` (bairro), `city` (localidade), `state` (uf)
3. Não altera campos "Número" e "Complemento" (que ficam vazios para o usuário preencher)

### Alterações em `ConfiguracoesModule.tsx`
- Adicionar `neighborhood` ao estado `form`
- Adicionar campo "Bairro" na UI (grid junto com Cidade/Estado/CEP)
- No campo CEP, adicionar `onBlur` ou detecção de 8 dígitos para chamar ViaCEP
- Incluir `neighborhood` no `updateClinicMutation`
- Reorganizar grid: CEP primeiro (para auto-preencher os demais), depois Logradouro, Bairro, Cidade, Estado

### Alterações em `ClientesModule.tsx`
- Adicionar `neighborhood` ao `emptyForm` e ao `openEdit`
- Adicionar campo "Bairro" no formulário de cadastro/edição
- Adicionar campo "CEP" (que não aparece no form atual) com auto-preenchimento via ViaCEP
- Incluir `neighborhood` no `saveMutation`
- Reorganizar campos de endereço: CEP → Endereço → Bairro → Cidade → Estado

### Alterações em `ClientDetailsDialog.tsx`
- Exibir bairro no endereço formatado

### Arquivos afetados
- Nova migração SQL (1 arquivo)
- `src/components/modules/ConfiguracoesModule.tsx`
- `src/components/modules/ClientesModule.tsx`
- `src/components/modules/clients/ClientDetailsDialog.tsx`

