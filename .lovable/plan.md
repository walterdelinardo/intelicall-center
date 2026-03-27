

## Plano: Dashboard dinâmico com filtros e Label vinculado a perfil podólogo

### Parte 1: Configurações — Label do Google Calendar como seletor de podólogos

**Arquivo:** `src/components/modules/ConfiguracoesModule.tsx` (linhas ~900-940)

- Substituir o campo de edição inline do Label por um `Select` que lista os perfis com papel de podólogo
- Query: buscar `user_role_assignments` + `role_definitions` (filtrar por slug que contenha "podologo" ou nome similar) + join com `profiles` para obter `full_name`
- O valor selecionado é salvo como `label` na `google_calendar_accounts` via `updateLabel(acc.id, selectedName)`
- Manter fallback para edição manual caso não haja podólogos cadastrados

### Parte 2: DashboardHome — Reescrever com dados reais e filtros

**Arquivo:** `src/components/modules/DashboardHome.tsx` (reescrita completa)

#### Filtros (barra superior):
1. **Período**: Hoje / Semana (seg-dom) / Mês
2. **Podólogo** (somente admin): Select com lista de podólogos (por `calendar_label` das contas Google Calendar). Não-admin vê apenas seus próprios dados (filtra por `calendar_label` que corresponde ao seu perfil)
3. **Tipo de procedimento**: Select com procedimentos da tabela `procedures`
4. **Categoria**: Todos / Procedimento / Produto (filtra por `category` em `financial_transactions`)

#### Lógica de filtragem:
- Buscar `financial_transactions` com filtros compostos:
  - `date` dentro do período selecionado
  - `calendar_label` = podólogo selecionado (ou do usuário logado se não-admin)
  - `description ILIKE procedimento` se filtro de procedimento ativo
  - `category` = "atendimento" (procedimento) ou "produto" (produto)
- Buscar `appointments` com mesmos filtros de data e `calendar_label`

#### Cards (todos reativos aos filtros):
1. **Agendamentos** — count de appointments no período filtrado
2. **Faturamento** — soma de `amount` das transações (receita, não cancelado)
3. **Novos Clientes** — clients com `created_at` no período
4. **Em Espera** — waiting_list com status "aguardando"
5. **Últimos 7 dias** — valor total + quantidade total de transações dos últimos 7 dias
6. **Acumulado Mensal (todos os meses do ano)** — tabela/card com valor e quantidade por mês do ano corrente

#### Seção inferior:
- Manter cards "Agendamentos de Hoje" e "Últimas Conversas"

### Parte 3: Vincular dados ao `calendar_label`

- O `calendar_label` na `financial_transactions` já é persistido pelo módulo Agenda (confirmado no código)
- Para não-admin: buscar as `google_calendar_accounts` onde o `label` corresponde ao `full_name` do perfil logado, e filtrar transações por esse `calendar_label`
- Para admin: listar todos os `calendar_label` distintos das contas Google Calendar ativas como opções do filtro

### Arquivos modificados:
1. `src/components/modules/ConfiguracoesModule.tsx` — Select de podólogos no Label
2. `src/components/modules/DashboardHome.tsx` — Reescrita com queries reais, filtros e novos cards

### Detalhes técnicos:
- Query de podólogos: `user_role_assignments` → `role_definitions` (filtrar nomes/slugs de podólogo) → `profiles` para nomes
- Todas as queries usam `useQuery` do TanStack com chaves reativas aos filtros
- Período "Semana": calcula segunda-feira anterior e domingo seguinte com `startOfWeek`/`endOfWeek` do date-fns
- Card "Meses do ano": query única de jan-dez do ano corrente, agrupado por mês no front-end

