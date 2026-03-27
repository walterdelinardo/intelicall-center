

## Sistema de Papéis Dinâmicos com Permissões por Módulo

### Resumo

Criar um sistema RBAC (Role-Based Access Control) completo e escalável com:
- Tabela de definições de papéis customizáveis por clínica
- Tabela de permissões granulares (ler/editar/excluir) por módulo
- Papel **super-admin** com acesso ilimitado (hardcoded, não editável)
- Aba "Papéis" no módulo Usuários para gerenciar tudo
- Walter Eduardo recebe o papel super-admin

### Banco de Dados (Migrations)

**1. Tabela `role_definitions`**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| clinic_id | uuid | Clínica dona |
| name | text | Nome do papel (ex: "Recepcionista") |
| slug | text | Identificador único por clínica |
| color | text | Cor do badge (#hex) |
| is_system | boolean | Se é papel do sistema (super-admin) |
| is_super_admin | boolean | Acesso total |
| created_at | timestamptz | |

**2. Tabela `role_permissions`**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| role_definition_id | uuid FK | Papel |
| module_key | text | Ex: "agenda", "financeiro", "estoque" |
| can_read | boolean | Pode visualizar |
| can_edit | boolean | Pode criar/editar |
| can_delete | boolean | Pode excluir |

**3. Tabela `user_role_assignments`**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| user_id | uuid | |
| role_definition_id | uuid FK | |
| clinic_id | uuid | |

**4. RLS**: Todas as tabelas com policies baseadas em `get_user_clinic_id(auth.uid())`. Apenas super-admin e admin podem gerenciar.

**5. Seed**: Inserir papel "Super Admin" com `is_super_admin = true` e atribuir ao Walter Eduardo (buscar por nome na tabela profiles).

### Lista de Módulos para Permissões

```text
dashboard, agenda, clientes, conversas, prontuarios, 
procedimentos, lista-espera, financeiro, estoque, 
leads, usuarios, configuracoes
```

### Alterações em Código

**1. `src/components/modules/UsuariosModule.tsx`**
- Adicionar Tabs: "Usuários" (conteúdo atual) e "Papéis"
- Aba Papéis mostra tabela com todos os role_definitions da clínica
- Botões: Criar, Editar, Excluir papel
- Dialog de criação/edição com: nome, slug, cor, e uma matriz de checkboxes (módulos × permissões)
- Super-admin aparece na lista mas não pode ser editado/excluído

**2. `src/contexts/AuthContext.tsx`**
- Buscar `user_role_assignments` + `role_definitions` + `role_permissions` do usuário
- Expor funções: `hasModuleAccess(module, permission)` e `isSuperAdmin`
- Super-admin retorna `true` para tudo

**3. `src/components/dashboard/AppSidebar.tsx`**
- Substituir a lógica `canSee` hardcoded por `hasModuleAccess(moduleKey, 'read')`
- Super-admin vê tudo

### Detalhes Técnicos

- O sistema antigo (enum `app_role` + `user_roles`) será mantido por compatibilidade mas o novo sistema (`role_definitions` + `user_role_assignments`) será a fonte de verdade para permissões
- A UI de atribuição de papéis na aba "Usuários" passará a usar os papéis dinâmicos da tabela `role_definitions`
- Papéis pré-existentes (admin, recepção, podólogo, financeiro) serão criados como seed na migração para manter compatibilidade

