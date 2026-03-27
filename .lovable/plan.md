

## Plano: Migrar do sistema legado `user_roles` para o sistema dinâmico `role_definitions` + `user_role_assignments`

### Problema

O sistema atualmente tem **duas tabelas de papéis coexistindo**:
- **Legada**: `user_roles` (com enum `app_role`: admin, recepcao, podologo, financeiro)
- **Nova**: `role_definitions` + `role_permissions` + `user_role_assignments` (dinâmica, com permissões granulares)

O cabeçalho e sidebar ainda leem da tabela legada (`roles` no AuthContext), por isso mostra "Recepção" mesmo após alterar o papel no novo sistema.

### Impacto da tabela legada no sistema

| Local | O que usa | Problema |
|---|---|---|
| `DashboardHeader.tsx` | `roles` → exibe badges "Recepção", "Admin" etc | Mostra papel errado |
| `AppSidebar.tsx` | `roles[0]` no rodapé | Mostra papel errado |
| `AuthContext.tsx` | `fetchRoles()` lê `user_roles` | Alimenta dados desatualizados |
| `AuthContext.tsx` | `hasRole()` checa tabela legada | Usado em ConfiguracoesModule e UsuariosModule |
| `ConfiguracoesModule.tsx` | `hasRole("admin")` para checar admin | Pode bloquear acesso indevidamente |
| `ClientesModule.tsx` | Query direta em `user_roles` para listar podólogos | Pode não encontrar profissionais |
| **RLS policies** (6 tabelas) | `has_role(auth.uid(), 'admin')` | Bloqueia operações se não tiver registro na tabela legada |

### Decisão recomendada

**Abandonar a tabela legada** e migrar tudo para o sistema dinâmico. A tabela `user_roles` continuará existindo no banco (não deletar para segurança), mas o código não a usará mais.

### Alterações necessárias

#### 1. `src/contexts/AuthContext.tsx`
- **Remover** `fetchRoles()` e o state `roles`
- **Substituir** `roles` por `assignedRoles` (que já existe e vem da tabela nova)
- **Substituir** `hasRole()` → usar `isSuperAdmin` ou `hasModuleAccess()` conforme o caso
- Expor `assignedRoles` (já expõe) para exibição de badges no header/sidebar

#### 2. `src/components/dashboard/DashboardHeader.tsx`
- Trocar `roles.map(r => roleLabels[r])` por `assignedRoles.map(r => r.name)` com a cor `r.color`
- Usar badges coloridos com os nomes dos papéis dinâmicos

#### 3. `src/components/dashboard/AppSidebar.tsx`
- Trocar `roles[0]` por `assignedRoles.map(r => r.name).join(", ")` ou exibir o primeiro papel dinâmico

#### 4. `src/components/modules/ConfiguracoesModule.tsx`
- Trocar `hasRole("admin")` por `isSuperAdmin || hasModuleAccess("configuracoes", "edit")`

#### 5. `src/components/modules/ClientesModule.tsx`
- Substituir query em `user_roles` (buscando podólogos) por query em `user_role_assignments` + `role_definitions` para encontrar profissionais com o papel adequado

#### 6. RLS Policies (migração SQL)
- Criar função `has_dynamic_role()` ou atualizar `has_role()` para consultar `user_role_assignments` + `role_definitions` ao invés de `user_roles`
- Isso corrige as 6 tabelas que usam `has_role()` nas policies: `clinics`, `user_roles`, `whatsapp_inboxes`, `telegram_bots`, `role_permissions`, `role_definitions`, `user_role_assignments`
- A abordagem mais segura: **atualizar a função `has_role()`** para checar ambas as tabelas (legada OR nova), garantindo retrocompatibilidade

#### 7. Nenhuma tabela deletada
A tabela `user_roles` permanece no banco por segurança, mas o código front-end não a consultará mais.

### Resultado

- Header e sidebar mostrarão os papéis corretos do sistema dinâmico
- `hasRole("admin")` será substituído por checagens no sistema dinâmico
- RLS policies funcionarão com ambos os sistemas durante a transição
- Listagem de profissionais (podólogos) usará a tabela nova

