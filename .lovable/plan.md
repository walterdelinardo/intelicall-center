

## Plano: Módulo Completo de Atendimento WhatsApp com Inboxes

### Situação Atual
O sistema já tem tabelas `whatsapp_conversations` e `whatsapp_messages` com um modelo simples (1 número por clínica). Precisamos evoluir para suportar múltiplos números/inboxes por clínica, estados de conversa (bot/humano/aguardando/encerrado), e uma interface completa de atendimento.

### 1. Migração de Banco de Dados

**Nova tabela `whatsapp_inboxes`** — representa cada número WhatsApp conectado:
- `id`, `clinic_id`, `instance_name` (nome na Evolution API), `phone_number`, `label` (ex: "Recepção", "Financeiro"), `is_active`, `created_at`, `updated_at`
- RLS: isolamento por `clinic_id` via `get_user_clinic_id()`

**Alterar `whatsapp_conversations`:**
- Adicionar coluna `inbox_id` (FK para `whatsapp_inboxes`)
- Adicionar coluna `conversation_status` com valores: `bot`, `humano`, `aguardando_cliente`, `encerrado` (default: `bot`)
- Adicionar coluna `assigned_to` (UUID, referência ao operador que assumiu)
- Atualizar unique constraint para `(inbox_id, remote_jid)` em vez de `(clinic_id, remote_jid)`

**Habilitar realtime** para `whatsapp_inboxes`.

**RLS** para as novas colunas segue o padrão existente por `clinic_id`.

### 2. Edge Function: `evolution-webhook` (reescrever)

- Receber payload do N8N contendo `instance_name` (ou `inbox_id`) além de `clinic_id`
- Localizar o `inbox_id` correto a partir de `instance_name + clinic_id`
- Vincular conversa ao `inbox_id`
- Manter lógica de upsert de conversa e mensagem existente

### 3. Edge Function: `send-evolution-message` (atualizar)

- Receber `inbox_id` no payload para saber qual instância da Evolution API usar
- Buscar `instance_name` da tabela `whatsapp_inboxes` para montar o endpoint correto
- Permitir envio de mídia (imagem, documento, áudio)

### 4. Frontend — Interface de Atendimento

**Componente `ChatTab.tsx`** será reescrito com:

**Painel esquerdo (sidebar de inboxes + conversas):**
- Seletor de inbox (dropdown ou tabs com as caixas de entrada da clínica)
- Lista de conversas filtrada pelo inbox selecionado
- Busca por nome/telefone
- Badge de não lidas
- Indicador do status da conversa (bot/humano/etc)

**Painel central (conversa):**
- Histórico de mensagens com scroll infinito
- Indicadores de tipo de mídia
- Status de envio (sent/delivered/read)
- Campo de envio de texto
- Botão de envio de mídia (imagem/documento)
- Botão "Assumir conversa" — muda status para `humano` e `assigned_to` para o operador atual
- Botão "Devolver ao bot" — muda status para `bot`
- Botão "Encerrar conversa" — muda status para `encerrado`

**Hooks novos/atualizados:**
- `useWhatsAppInboxes()` — lista inboxes da clínica
- `useWhatsAppConversations(inboxId)` — conversas filtradas por inbox
- `useWhatsAppMessages(conversationId)` — sem mudança significativa
- `useConversationActions()` — assumir, devolver ao bot, encerrar

### 5. Payload N8N Atualizado

O N8N deverá enviar:
```json
{
  "clinic_id": "...",
  "instance_name": "nome_da_instancia_evolution",
  "event": "messages.upsert",
  "data": { ... }
}
```

### Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/new.sql` | Criar `whatsapp_inboxes`, alterar `whatsapp_conversations` |
| `supabase/functions/evolution-webhook/index.ts` | Reescrever com suporte a inbox |
| `supabase/functions/send-evolution-message/index.ts` | Atualizar para usar inbox |
| `src/hooks/useWhatsApp.ts` | Adicionar hooks de inboxes e ações de conversa |
| `src/components/dashboard/ChatTab.tsx` | Reescrever interface completa |
| `src/components/modules/ConversasModule.tsx` | Pode manter como wrapper |

