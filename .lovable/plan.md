

## Plano: Permitir múltiplos papéis por usuário

### Situação atual

- O `UsuariosModule` usa um `Select` simples (single) para atribuir papel — ao trocar, deleta todos os assignments e insere apenas um
- O `AuthContext.fetchDynamicPermissions` já busca múltiplos assignments e faz merge com lógica OR (prevalece o maior acesso) — **já funciona para múltiplos papéis**
- O filtro de super admin já verifica se **algum** dos papéis é super admin

### Alterações necessárias

#### 1. `src/components/modules/UsuariosModule.tsx`

- **`getUserAssignedRole`** → renomear para `getUserAssignedRoles`, retornar array de `role_definition_id`
- **Filtro super admin**: verificar se algum dos papéis atribuídos é super admin (ao invés de apenas um)
- **UI da coluna Papel**: trocar o `Select` simples por um sistema multi-select com checkboxes (Popover + lista de checkboxes com os papéis disponíveis)
  - Exibir os papéis atribuídos como Badges coloridos
  - Ao marcar/desmarcar, inserir ou deletar individualmente na tabela `user_role_assignments`
- **`assignRoleMutation`**: refatorar para receber `{ userId, roleDefId, action: 'add' | 'remove' }` — inserir ou deletar um assignment individual ao invés de substituir todos

#### 2. Nenhuma alteração de banco

A tabela `user_role_assignments` já suporta múltiplos registros por `user_id` (não tem constraint unique em user_id+clinic_id, apenas em user_id+role_definition_id se houver). Não precisa de migração.

#### 3. Nenhuma alteração no AuthContext

O `fetchDynamicPermissions` já faz merge OR de múltiplos papéis corretamente.

### Resultado

Um usuário poderá ter, por exemplo, os papéis "Podólogo" e "Financeiro" simultaneamente. As permissões serão a **união** (OR) de ambos — sempre prevalece o maior acesso.

