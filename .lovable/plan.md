

## Diagnóstico

Os dados no banco confirmam o problema: **todos os campos estão vazios**. A conversa e as 6 mensagens registradas têm `remote_jid = ''`, `contact_name = ''`, `contact_phone = ''`, `content = ''`, `sender_name = ''`, `inbox_id = null`.

**Causa raiz**: O payload que o N8N envia não está no formato que o webhook espera. O webhook espera `data.key.remoteJid`, `data.message.conversation`, `data.pushName`, etc. — mas o N8N provavelmente está enviando o payload da Evolution em uma estrutura diferente (campos no nível raiz do `data`, ou o payload inteiro da Evolution sem o wrapper `clinic_id`/`instance_name`/`data`).

Existe também um inbox cadastrado (`demo-nw-1`, clinic `61ebdc1a...`) mas nenhuma mensagem foi vinculada a ele porque `instance_name` não chega no payload.

## Plano de Correção

### 1. Refatorar `evolution-webhook/index.ts` — Extração robusta do payload

Tornar o webhook capaz de aceitar **múltiplos formatos** de payload:

**Formato A** (wrapper manual do N8N):
```json
{ "clinic_id": "...", "instance_name": "demo-nw-1", "event": "messages.upsert", "data": { "key": {...}, "message": {...} } }
```

**Formato B** (payload direto da Evolution API v3):
```json
{ "event": "messages.upsert", "instance": "demo-nw-1", "data": { "key": {...}, "message": {...} } }
```

**Formato C** (N8N achatado — campos no nível raiz):
```json
{ "clinic_id": "...", "instance_name": "demo-nw-1", "event": "messages.upsert", "remoteJid": "...", "content": "...", "fromMe": false, ... }
```

Mudanças específicas:

1. **Extrair `instance_name`** de `payload.instance_name || payload.instance || payload.data?.instance`
2. **Permitir `clinic_id` opcional** — se ausente, buscar na tabela `whatsapp_inboxes` pelo `instance_name`
3. **Extrair `remoteJid`** com fallbacks: `data.key?.remoteJid || data.remoteJid || payload.remoteJid || data.data?.key?.remoteJid`
4. **Extrair `content`** com fallbacks: `data.message?.conversation || data.message?.extendedTextMessage?.text || data.body || data.content || payload.content`
5. **Extrair `pushName`**: `data.pushName || data.senderName || data.sender?.pushName || payload.pushName`
6. **Extrair `messageId`**: `data.key?.id || data.messageId || data.id`
7. **Extrair `fromMe`**: `data.key?.fromMe || data.fromMe`
8. **Validação**: Rejeitar com log detalhado se `remoteJid` continuar vazio após todos os fallbacks
9. **Logging melhorado**: Logar as top-level keys do payload e do `data` para facilitar debugging futuro

### 2. Limpar dados inválidos

Criar uma migration para excluir os registros vazios existentes:
- Deletar mensagens com `content = ''` ou `content IS NULL` vinculadas a conversas com `remote_jid = ''`
- Deletar conversas com `remote_jid = ''`

### 3. Nenhuma mudança no frontend

O módulo Conversas, hooks e componentes já estão corretos. O problema é exclusivamente no mapeamento do payload na edge function.

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `supabase/functions/evolution-webhook/index.ts` | Refatorar extração de payload com múltiplos formatos |
| Migration SQL | Limpar registros vazios |

