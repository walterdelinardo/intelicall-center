

## Plano: Fluxo completo de "Abrir Chat" com seleção de instância

### Problema atual
O botão de chat nos módulos Clientes e Lista de Espera apenas navega para o módulo Conversas e tenta encontrar uma conversa existente. Falta:
1. Dialog para selecionar a instância WhatsApp
2. Criar conversa automaticamente se não existir
3. Filtrar pelo inbox selecionado ao redirecionar

### Alterações

#### 1. `DashboardContext.tsx` — Expandir estado

Adicionar `pendingChatInboxId` ao contexto. Mudar `openChatWithPhone` para abrir um dialog de seleção de instância em vez de navegar diretamente. Adicionar novo campo `showInboxPicker` (boolean) e `pendingChatPhoneForPicker` para controlar o fluxo.

Nova função `confirmChatWithInbox(inboxId: string)` que:
- Armazena phone + inboxId no contexto
- Navega para "conversas"

#### 2. Novo componente `InboxPickerDialog.tsx`

Dialog modal que:
- Recebe as inboxes ativas da clínica (via query)
- Lista as instâncias disponíveis com nome e número
- Ao selecionar, chama `confirmChatWithInbox(inboxId)`
- Renderizado no `Dashboard.tsx` (nível global)

#### 3. `ChatTab.tsx` — Lógica de auto-seleção/criação

Quando recebe `pendingChatPhone` + `pendingChatInboxId`:
1. Filtra o inbox selecionado no select de caixas
2. Busca conversa existente com aquele phone + inbox
3. Se não encontrar, cria nova conversa na tabela `whatsapp_conversations` com:
   - `clinic_id` do usuário
   - `inbox_id` selecionado
   - `remote_jid` formatado como `55PHONE@s.whatsapp.net`
   - `contact_name` (se disponível)
   - `contact_phone` = phone
4. Seleciona a conversa (nova ou existente)

#### 4. `ClientesModule.tsx` e `ListaEsperaModule.tsx`

Sem mudanças — já chamam `openChatWithPhone`. A mudança é no contexto que agora abre o picker antes de navegar.

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/contexts/DashboardContext.tsx` | Adicionar estado de picker + inboxId |
| `src/components/dashboard/InboxPickerDialog.tsx` | Novo — dialog de seleção de instância |
| `src/pages/Dashboard.tsx` | Renderizar InboxPickerDialog |
| `src/components/dashboard/ChatTab.tsx` | Auto-criar conversa + filtrar inbox |

