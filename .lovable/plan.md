

## Permissões por Aba dentro de cada Módulo

### Resumo

Expandir o sistema RBAC para permitir controle granular por **aba** (sub-tab) dentro de cada módulo. Ao editar um papel, além de marcar Ler/Editar/Excluir por módulo, o admin poderá expandir cada módulo e selecionar quais abas específicas estão acessíveis.

### Mapeamento de Abas por Módulo

```text
agenda:         calendario, notificacoes
conversas:      whatsapp, telegram
financeiro:     daily (Caixa Diário), monthly (Caixa Mensal), commissions (Comissões)
prontuarios:    clinical, assessments, procedures, documents, history
usuarios:       usuarios, papeis
configuracoes:  general, hours, integrations
```

Módulos sem abas (dashboard, clientes, estoque, leads, procedimentos, lista-espera) ficam sem sub-items.

### Banco de Dados

**Adicionar coluna `allowed_tabs` à tabela `role_permissions`:**

```sql
ALTER TABLE role_permissions ADD COLUMN allowed_tabs text[] DEFAULT NULL;
```

- `NULL` ou array vazio = acesso a todas as abas (comportamento padrão, retrocompatível)
- Array com valores = acesso apenas às abas listadas (ex: `{daily, monthly}`)

### Alterações em Código

**1. `src/components/modules/usuarios/RolesTab.tsx`**
- Exportar constante `MODULE_TABS` com o mapeamento módulo → abas

**2. `src/components/modules/usuarios/RoleFormDialog.tsx`**
- Na matriz de permissões, para módulos que têm abas, adicionar uma linha expansível (accordion/collapsible) abaixo do módulo
- Dentro da expansão: checkboxes para cada aba do módulo
- Estado `allowedTabs` por módulo no formulário
- Salvar o array de abas selecionadas na coluna `allowed_tabs`
- Se todas as abas estão marcadas, salvar `NULL` (acesso total)

**3. `src/contexts/AuthContext.tsx`**
- Incluir `allowed_tabs` no fetch de permissões
- Adicionar helper `hasTabAccess(moduleKey, tabKey)`:
  - Super-admin → `true`
  - `allowed_tabs` é null/vazio → `true`
  - Caso contrário, verifica se `tabKey` está no array

**4. Módulos com abas (Agenda, Conversas, Financeiro, Prontuários, Usuários, Configurações)**
- Filtrar `TabsTrigger` com `hasTabAccess(moduleKey, tabValue)`
- Se a aba default não está acessível, selecionar a primeira aba permitida

### Detalhes Técnicos

- A coluna `allowed_tabs` usa tipo `text[]` (array nativo do Postgres), sem necessidade de nova tabela
- Retrocompatível: registros existentes terão `NULL`, significando acesso total
- O types.ts será atualizado automaticamente após a migration

