## Plano: Redirecionar botões "Conversar" para o chat interno

### Problema

Os botões de conversa no módulo Clientes abrem `wa.me` (link externo) e no módulo Lista de Espera enviam notificação via edge function. O usuário quer que redirecionem para o módulo de Conversas interno e antes de iniciar a conversa o sistema mostra a lisa com as instancias disponíveis para o usuário selecionar uma e abrir a conversa usando a instancia selecionada

### Abordagem

O Dashboard.tsx gerencia a navegação entre módulos via `setActiveModule` (estado local). Os módulos não têm acesso a essa função. A solução é criar um contexto de navegação compartilhado.

### Alterações

#### 1. Criar `DashboardContext` com navegação + conversa selecionada

Novo contexto (`src/contexts/DashboardContext.tsx`) que expõe:

- `navigateToModule(module: string)` — troca o módulo ativo
- `openChatWithPhone(phone: string)` — navega para "conversas" e armazena o telefone para pré-selecionar a conversa

#### 2. `Dashboard.tsx` — Prover o contexto

Envolver os módulos com `DashboardProvider`, passando `setActiveModule` e um estado `pendingChatPhone`.

#### 3. `ClientesModule.tsx` — Alterar botão WhatsApp

Trocar o link `wa.me` por um `onClick` que chama `openChatWithPhone(client.whatsapp)`.

#### 4. `ListaEsperaModule.tsx` — Adicionar botão de chat interno

alterar o botão existente que chama `openChatWithPhone(phone)` para abrir a conversa no chat interno. O botão de notificação pode permanecer para enviar a mensagem automática.

#### 5. `ChatTab.tsx` — Auto-selecionar conversa pelo telefone

Ao montar, verificar se existe um `pendingChatPhone` no contexto. Se sim, buscar a conversa correspondente na lista e selecioná-la automaticamente, depois limpar o pending.

### Arquivos


| Arquivo                                        | Mudança                               |
| ---------------------------------------------- | ------------------------------------- |
| `src/contexts/DashboardContext.tsx`            | Novo — contexto de navegação          |
| `src/pages/Dashboard.tsx`                      | Envolver com provider                 |
| `src/components/modules/ClientesModule.tsx`    | Botão abre chat interno               |
| `src/components/modules/ListaEsperaModule.tsx` | Botão abre chat interno               |
| `src/components/dashboard/ChatTab.tsx`         | Auto-selecionar conversa por telefone |
