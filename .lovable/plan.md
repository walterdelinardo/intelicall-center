

## Plano: Refatorar webhook Evolution com deduplicação, extração robusta de mídia e fallback de áudio

### Contexto do problema

O payload real chega como `{ raw: $json.raw_payload }`. Dentro de `raw.data`, o campo `base64` pode ou não existir dependendo da configuração do N8N/Evolution. Atualmente:
- `base64` não é encontrado porque o normalizador não busca em todos os caminhos possíveis
- Dois webhooks (flat + raw) chegam para a mesma mensagem, gerando duplicatas
- O Chatwoot envia para o mesmo endpoint e pode interferir
- O `media_url` existe mas não é aproveitado quando `base64` está ausente

### Mudanças

#### 1. Edge Function `supabase/functions/evolution-webhook/index.ts` — Reescrita completa

**a) Funções utilitárias de detecção e extração:**

- `detectPayloadFormat(payload)` — retorna `'raw'`, `'flat'`, `'chatwoot'` ou `'unknown'`
  - `'raw'`: tem `payload.raw.data.key`
  - `'flat'`: tem `payload.remote_jid` ou `payload.message_id` no top-level
  - `'chatwoot'`: tem `payload.event` com valores tipo `message_created`, `conversation_created`
  - `'unknown'`: fallback

- `shouldIgnoreWebhook(payload, format)` — retorna `true` para:
  - Formato `'chatwoot'` (tem endpoint separado)
  - Formato `'unknown'` sem dados extraíveis

- `resolveMediaFields(payload)` — busca base64, mediaUrl, mimeType, fileName, duration em todos os caminhos possíveis, nesta ordem de prioridade:
  ```text
  base64:  payload.raw.data.base64 → payload.raw.data.message.[type].base64
           → payload.base64 → payload.media_base64 → payload.audio_base64
  
  mediaUrl: payload.raw.data.message.[type].url → payload.raw.data.mediaUrl
            → payload.media_url → payload.mediaUrl
  
  mimeType: payload.raw.data.message.[type].mimetype → payload.raw.data.mimetype
            → payload.mime_type → payload.mimeType
  
  seconds:  payload.raw.data.message.[type].seconds
  fileName: payload.raw.data.message.[type].fileName
  ```
  Retorna `{ base64, mediaUrl, mimeType, fileName, duration, sourceUsed }` onde `sourceUsed` indica de onde veio a mídia

- `normalizeIncomingMessage(payload)` — orquestrador principal que:
  1. Detecta formato
  2. Extrai campos básicos (remoteJid, messageId, fromMe, pushName, event, instanceName, timestamp)
  3. Determina messageType a partir de `data.messageType` (mapeando `audioMessage→audio`, etc.) ou detectando qual chave existe em `data.message`
  4. Chama `resolveMediaFields` para mídia
  5. Monta content (texto de `message.conversation` / `extendedTextMessage.text`, ou placeholder para mídia)
  6. Retorna o `NormalizedPayload` enriquecido com `payloadFormat` e `sourceUsed`

**b) Deduplicação por `message_id`:**

- `upsertMessage` já faz select por `message_id` antes de inserir — manter esse comportamento
- Na atualização: preservar campos de mídia não-nulos (merge, não overwrite com null) — já implementado parcialmente, reforçar com a lista completa de `MEDIA_FIELDS`
- Adicionar log quando mensagem duplicada é detectada: `"Duplicate ignored — format: flat, existing from: raw"`

**c) Filtro de Chatwoot no início do handler:**

```typescript
const format = detectPayloadFormat(payload);
if (format === 'chatwoot') {
  console.log("Chatwoot payload ignored — use /chatwoot-webhook endpoint");
  return Response 200 with { ignored: true, reason: 'chatwoot' };
}
```

**d) Logs estruturados:**

Após normalização, logar:
```json
{
  "payloadFormat": "raw",
  "event": "messages.upsert",
  "messageId": "AC6D...",
  "messageType": "audio",
  "hasBase64": true,
  "hasMediaUrl": true,
  "mimeType": "audio/ogg; codecs=opus",
  "sourceUsed": "raw.data.message.audioMessage.base64",
  "mediaSeconds": 3,
  "duplicateIgnored": false
}
```

#### 2. Frontend `src/components/dashboard/chat/MessageBubble.tsx`

O `AudioContent` já está correto — usa `getMediaSrc()` que prioriza base64 e faz fallback para `media_url`. Nenhuma mudança estrutural necessária.

Apenas uma melhoria menor: se `mime_type` estiver vazio e `message_type === 'audio'`, usar `audio/ogg` como fallback seguro no `getMediaSrc` para evitar `data:application/octet-stream` que alguns browsers não reproduzem.

#### 3. Nenhuma mudança no banco

A tabela `whatsapp_messages` já tem todos os campos necessários (base64, media_url, mime_type, media_seconds, etc.). Não é necessário adicionar colunas.

### Resultado esperado

- Áudios tocam quando só existe `media_url` (fallback funciona)
- Áudios tocam quando `base64` está em qualquer caminho do payload
- Mensagens duplicadas (flat vs raw) não geram registros duplicados
- Webhooks do Chatwoot são filtrados no início sem quebrar o pipeline
- Logs mostram claramente o formato, a origem da mídia e se houve deduplicação

