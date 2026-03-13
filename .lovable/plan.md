

## Plano: Reescrever normalizer para formato `{ raw: $json.raw_payload }`

O payload agora chega com estrutura fixa `{ raw: { event, instance, data: { ... } } }`. O normalizador atual tenta múltiplos formatos (N8N achatado, Chatwoot, etc.) mas falha em extrair dados como `base64` porque eles estão em `raw.data.base64`, não no top-level.

### O que tem no payload (tudo que é necessário)

```text
raw.event              → "messages.upsert"
raw.instance           → "demo-nw-1" (instance_name)
raw.data.key.remoteJid → JID do contato
raw.data.key.fromMe    → boolean
raw.data.key.id        → message_id
raw.data.pushName      → nome do contato
raw.data.status        → "DELIVERY_ACK"
raw.data.messageType   → "audioMessage" / "imageMessage" etc.
raw.data.messageTimestamp → unix timestamp
raw.data.base64        → conteúdo da mídia em base64
raw.data.message       → { audioMessage: { url, mimetype, seconds, ptt, ... } }
```

Tem tudo. Não falta nada.

### Mudança

**Arquivo:** `supabase/functions/evolution-webhook/index.ts`

Reescrever `normalizePayload` para extrair diretamente de `payload.raw`:

1. **Resolver estrutura**: `const raw = payload.raw || payload; const data = raw.data || raw;`
2. **Campos diretos**:
   - `event` = `raw.event`
   - `instanceName` = `raw.instance`
   - `remoteJid` = `data.key?.remoteJid`
   - `isFromMe` = `data.key?.fromMe`
   - `messageId` = `data.key?.id`
   - `contactName` = `data.pushName`
   - `messageTimestamp` = `data.messageTimestamp`
   - `base64` = `data.base64`
3. **Tipo de mensagem**: Mapear `data.messageType` ("audioMessage" → "audio", "imageMessage" → "image", etc.). Fallback: detectar qual chave existe em `data.message`.
4. **Metadados de mídia**: Extrair do objeto específico em `data.message`:
   - `audioMessage` → `mimetype`, `seconds`, `url`
   - `imageMessage` → `mimetype`, `caption`, `url`
   - `videoMessage` → `mimetype`, `caption`, `seconds`, `url`
   - `documentMessage` → `mimetype`, `fileName`, `url`
   - `stickerMessage` → `mimetype`, `url`
5. **Content**: Para texto usar `data.message.conversation` ou `extendedTextMessage.text`. Para mídia usar caption ou placeholder (`[Áudio]`, `[Imagem]`, etc.)
6. Manter compatibilidade: se `payload.raw` não existir, usar payload direto como fallback (formato antigo).

### Sem mudanças no frontend
`MessageBubble.tsx` já renderiza corretamente com `base64` + `mime_type`.

