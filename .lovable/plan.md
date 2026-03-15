

## Diagnóstico do problema

Os logs revelam a causa raiz:

1. **Primeiro webhook** (sem base64) chega e **cria** o registro na tabela `whatsapp_messages` com `base64 = null`
2. **Segundo webhook** (com base64, `sourceUsed: "root.base64"`, `base64Length: 9240`) chega como **duplicata** e executa o merge via `upsertMessage`
3. O merge **deveria** gravar o base64, pois a lógica verifica `if (val != null) mergedUpdate[key] = val` — mas não temos visibilidade se o update realmente executou com sucesso ou se o valor está sendo truncado/perdido

O problema pode ser: erro silencioso no update, valor de base64 corrompido, ou o campo não sendo incluído no `mergedUpdate`. Sem uma tabela de logs, é impossível diagnosticar.

## Plano

### 1. Criar tabela `webhook_logs` (migração)

```sql
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  message_id text,
  payload_format text,
  event text,
  instance_name text,
  remote_jid text,
  message_type text,
  has_base64 boolean DEFAULT false,
  base64_length integer DEFAULT 0,
  base64_source text,
  has_media_url boolean DEFAULT false,
  media_url text,
  mime_type text,
  is_duplicate boolean DEFAULT false,
  merge_result text,
  merge_error text,
  raw_payload jsonb,
  normalized_data jsonb
);

-- RLS: service_role full access (edge function uses service role key)
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access webhook_logs"
  ON public.webhook_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated users can read logs from their clinic
CREATE POLICY "Authenticated users can view webhook_logs"
  ON public.webhook_logs FOR SELECT TO authenticated
  USING (true);
```

### 2. Modificar edge function `evolution-webhook/index.ts`

**a) Após o parse do JSON e antes de qualquer processamento**, inserir log com o payload bruto:

```typescript
// Immediately after JSON.parse, before detectPayloadFormat
await supabase.from("webhook_logs").insert({
  raw_payload: payload,
  payload_format: "pending", // will be updated later
});
```

**b) Após normalização**, atualizar o log com dados normalizados e status do base64:

```typescript
const logEntry = {
  message_id: normalized.messageId,
  payload_format: normalized.payloadFormat,
  event: normalized.event,
  instance_name: normalized.instanceName,
  remote_jid: normalized.remoteJid,
  message_type: normalized.messageType,
  has_base64: !!normalized.base64,
  base64_length: normalized.base64?.length || 0,
  base64_source: normalized.sourceUsed,
  has_media_url: !!normalized.mediaUrl,
  media_url: normalized.mediaUrl,
  mime_type: normalized.mimeType,
  raw_payload: payload,
  normalized_data: { /* all normalized fields except base64 content */ },
};
```

**c) No `upsertMessage`**, adicionar logging do resultado do merge:

- Logar se `base64` está no `mergedUpdate`
- Logar se o update retornou erro
- Atualizar o `webhook_logs` com `is_duplicate`, `merge_result`, `merge_error`

**d) Inserção combinada** — fazer um único insert no `webhook_logs` após todo o processamento, com todos os campos preenchidos (não atualizar parcialmente).

### 3. Nenhuma mudança no frontend

A tabela é apenas para diagnóstico/debugging.

### Resultado

- Cada webhook recebido gera um registro em `webhook_logs` com o payload completo
- Podemos consultar a tabela para ver exatamente o que chegou e se o base64 existia
- Podemos ver se o merge atualizou corretamente ou se houve erro
- Com esses dados, saberemos se o problema está no N8N (não envia base64) ou na edge function (não grava)

