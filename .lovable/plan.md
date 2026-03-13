

## Diagnóstico

Analisei o banco e o código. O cenário:

- Algumas mensagens de mídia **salvam corretamente** (ex: `AC6D004D8E7AB6A9B77BB9A3CC0BD4EE` tem base64 de 9240 bytes + mime_type `audio/ogg; codecs=opus`; imagem `3EB049BB` tem base64 de 157KB).
- Outras ficam com **base64 = NULL e media_url = NULL** (ex: `AC879ED7`, `3EB02538`, `ACFDEDE4`).

**Causa raiz**: `upsertMessage()` (linha 52-71) faz um `update(messageData)` completo quando o `message_id` já existe. Quando o mesmo `message_id` chega em um segundo evento (ex: delivery ack via `messages.upsert`), o payload não traz `base64`/`media_url`, e o update sobrescreve os valores salvos com `null`.

**Frontend**: `MessageBubble.tsx` já está correto — `getMediaSrc()` constrói `data:{mime_type};base64,{base64}` corretamente para qualquer tipo de mídia (áudio, imagem, vídeo).

## Correção

### Arquivo: `supabase/functions/evolution-webhook/index.ts`

**Única mudança**: Modificar `upsertMessage` para preservar campos de mídia existentes ao atualizar.

Ao fazer update de mensagem existente:
1. Buscar os campos de mídia atuais da mensagem existente (`base64`, `media_url`, `mime_type`, `media_type`, `caption`, `file_name`, `media_seconds`, `media_width`, `media_height`, `thumbnail_base64`)
2. Para cada campo de mídia: só sobrescrever se o novo valor for não-nulo
3. Isso garante que o primeiro base64 salvo nunca é apagado por eventos subsequentes

```text
Antes:  select('id') → update(messageData)
Depois: select('id, base64, media_url, mime_type, ...') → merge(preservando não-nulos) → update(merged)
```

Nenhuma mudança no frontend.

