

## Diagnóstico

O erro nos logs da edge function é claro:

```
"there is no unique or exclusion constraint matching the ON CONFLICT specification"
```

**Causa raiz**: A tabela `whatsapp_conversations` usa **indexes únicos parciais** (com cláusula `WHERE`):
- `(clinic_id, inbox_id, remote_jid) WHERE inbox_id IS NOT NULL`
- `(clinic_id, remote_jid) WHERE inbox_id IS NULL`

O Postgres **não suporta** `ON CONFLICT` com indexes parciais via a sintaxe padrão usada pelo Supabase SDK `.upsert()`. Isso faz com que o webhook falhe toda vez.

Além disso, o payload do N8N está chegando **sem `instance_name`**, o que faz o `inboxId` ficar `null`.

## Plano de Correção

### 1. Corrigir a edge function `evolution-webhook`

Substituir o `.upsert()` por um padrão **select + insert/update** manual:

1. Primeiro tentar `SELECT` a conversa existente com `clinic_id`, `inbox_id` e `remote_jid`
2. Se existir → `UPDATE` os campos `last_message`, `last_message_at`, etc.
3. Se não existir → `INSERT` nova conversa

Mesma lógica para o `send-evolution-message`.

### 2. Corrigir a edge function `send-evolution-message`

Aplicar o mesmo padrão select+insert/update no trecho de armazenamento da mensagem enviada.

### 3. Melhorar tratamento de resposta da Evolution API

Adicionar verificação do `Content-Type` antes de parsear JSON, para evitar erros quando a API retorna HTML (ex: erro de autenticação ou rate limiting).

### Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `supabase/functions/evolution-webhook/index.ts` | Substituir upsert por select+insert/update |
| `supabase/functions/send-evolution-message/index.ts` | Substituir upsert por select+insert/update + safe JSON parsing |

