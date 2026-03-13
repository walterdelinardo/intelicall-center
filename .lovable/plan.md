

## Problema Raiz

O N8N envia dois formatos de payload para o webhook, e o normalizador falha em ambos os cenários de imagem:

1. **Payload N8N normalizado (Evolution)**: Campos no top-level com snake_case (`media_url`, `from_me`, `push_name`, `message_id`). O código já tenta `payload.media_url` (funciona), mas falha em `payload.fromMe` (deveria ser `payload.from_me`). Além disso, `data = payload.data` aponta para o objeto raw da Evolution, e `data.content` pode não existir — mas `payload.content` sim.

2. **Payload Chatwoot**: `payload.data` contém `attachments` (array com objetos de mídia). O normalizador ignora completamente `attachments`, então imagens via Chatwoot nunca capturam `media_url`.

**Evidência do banco**: As 2 mensagens de imagem têm `media_url = NULL`, `base64 = NULL`, `mime_type = NULL` — todos os campos de mídia vazios.

**Evidência dos logs**: O payload N8N tem `media_url` no top-level, mas o Normalized log mostra apenas `content: "[Imagem]"` sem dados de mídia. Isso indica que o `media_url` está sendo perdido no processo ou que o payload específico da imagem veio pelo formato Chatwoot (via `attachments`).

## Plano de Correção

### 1. Melhorar o `normalizePayload` no `evolution-webhook/index.ts`

- **Adicionar suporte a snake_case do N8N**: `payload.from_me`, `payload.push_name`, `payload.message_id`, `payload.remote_jid` (já existe para remote_jid)
- **Adicionar suporte a `attachments`** (formato Chatwoot): Se `data.attachments` for um array não-vazio e não houver `mediaUrl`/`base64`, extrair do primeiro attachment (`data_url`, `file_type`, `content_type`)
- **Adicionar suporte a `mediaUrl` camelCase** no top-level: `payload.mediaUrl` como fallback adicional
- **Melhorar log do Normalized** para incluir `hasMediaUrl` e `hasBase64` (já estava previsto mas truncado)

### 2. Campos específicos a corrigir no normalizer

```text
isFromMe:  adicionar payload.from_me
messageId: adicionar payload.message_id  
contactName: adicionar payload.push_name, data.sender?.name
mediaUrl: adicionar payload.mediaUrl, data.attachments?.[0]?.data_url
mimeType: adicionar data.attachments?.[0]?.content_type
messageType: mapear data.attachments?.[0]?.file_type → message_type
messageTimestamp: adicionar payload.timestamp
```

### 3. Nenhuma mudança no frontend

O `MessageBubble.tsx` já está correto — renderiza imagem quando `base64` ou `media_url` existem. O problema é puramente no webhook que não salva os dados de mídia.

