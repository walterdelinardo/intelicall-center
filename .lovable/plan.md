

## Plano: Correção e Evolução da Sincronização WhatsApp

### Problemas Identificados

1. **Unique constraint errada**: O upsert de conversas usa `onConflict: 'clinic_id,remote_jid'`, mas deveria ser `clinic_id,inbox_id,remote_jid` para que o mesmo contato tenha conversas separadas por inbox/número.
2. **Realtime incompleto**: O hook `useWhatsAppMessages` só escuta `INSERT`, não escuta `UPDATE` (status de mensagem: sent → delivered → read).
3. **Envio de mídia ausente no frontend**: O hook `useSendWhatsAppMessage` só envia texto; a edge function já suporta mídia mas o frontend não usa.
4. **Filtros operacionais ausentes**: Não há filtro por status da conversa nem por atendente responsável.

### 1. Migração de Banco de Dados

- Dropar a unique constraint `whatsapp_conversations_clinic_id_remote_jid_key`
- Criar nova unique constraint `(clinic_id, inbox_id, remote_jid)` — com `inbox_id` NOT NULL default (ou tratamento de null)
- Habilitar realtime para `whatsapp_messages` (para refletir updates de status)

### 2. Edge Functions — Ajustes

**`evolution-webhook`**:
- Alterar upsert `onConflict` de `'clinic_id,remote_jid'` para `'clinic_id,inbox_id,remote_jid'`
- Garantir que `inbox_id` é sempre definido antes do upsert (já faz auto-create)
- Incluir `inbox_id` diretamente no objeto de upsert (não condicional)

**`send-evolution-message`**:
- Alterar upsert `onConflict` de `'clinic_id,remote_jid'` para `'clinic_id,inbox_id,remote_jid'`
- Incluir `inbox_id` sempre no objeto de upsert
- Guardar `media_url` e `media_type` na mensagem salva quando for mídia

### 3. Frontend — Hooks (`useWhatsApp.ts`)

- **`useWhatsAppMessages`**: Escutar evento `*` (INSERT + UPDATE) em vez de só `INSERT`, para atualizar status de mensagens em tempo real
- **`useSendWhatsAppMessage`**: Expandir para aceitar `messageType` e `mediaUrl` como parâmetros, passando para a edge function
- Adicionar filtros opcionais em `useWhatsAppConversations`: `statusFilter` e `assignedToFilter`

### 4. Frontend — Interface

**`ConversationList.tsx`**:
- Adicionar filtros por status da conversa (bot/humano/aguardando/encerrado/todos)
- Adicionar filtro por atendente (meus/todos)

**`ChatArea.tsx`**:
- Adicionar botões de envio de mídia (imagem e documento) com input file
- Upload do arquivo para storage bucket, obter URL pública, enviar via `sendMessage` com `messageType` e `mediaUrl`
- Exibir preview de mídia nas mensagens (imagem inline, link para documento)

**`ChatTab.tsx`**:
- Passar filtros de status e atendente para o hook de conversas

### 5. Storage

- Criar bucket `whatsapp-media` (público) para uploads de mídia enviada pelo operador

### Arquivos Afetados

| Arquivo | Ação |
|---|---|
| Migration SQL | Alterar unique constraint, habilitar realtime em `whatsapp_messages` |
| `supabase/functions/evolution-webhook/index.ts` | Corrigir onConflict para incluir inbox_id |
| `supabase/functions/send-evolution-message/index.ts` | Corrigir onConflict, salvar mídia |
| `src/hooks/useWhatsApp.ts` | Realtime UPDATE, filtros, suporte a mídia no envio |
| `src/components/dashboard/chat/ConversationList.tsx` | Filtros por status e atendente |
| `src/components/dashboard/chat/ChatArea.tsx` | Upload e envio de mídia, preview inline |
| `src/components/dashboard/ChatTab.tsx` | Conectar filtros |

