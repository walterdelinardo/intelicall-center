

## Plano: Sincronizar clientes com contatos da Evolution API

### Contexto

A Evolution API v3 expõe o endpoint `POST /chat/findContacts/{instance}` que retorna todos os contatos do WhatsApp. O objetivo é criar uma edge function que busca esses contatos e faz upsert na tabela `clients`, usando o número de WhatsApp como chave de matching.

### Mudanças

#### 1. Nova Edge Function `supabase/functions/sync-evolution-contacts/index.ts`

- Busca a lista de inboxes da clínica autenticada em `whatsapp_inboxes`
- Para cada inbox, chama `POST {EVOLUTION_API_URL}/chat/findContacts/{instance_name}` com header `apikey: {EVOLUTION_API_KEY}` e body `{ where: {} }` (todos os contatos)
- Cada contato retornado tem: `id`, `remoteJid`, `pushName`, `profilePicUrl`
- Normaliza o número do WhatsApp extraindo do `remoteJid` (remove `@s.whatsapp.net`)
- Para cada contato:
  - Busca na tabela `clients` por `whatsapp` ou `phone` que contenha o número normalizado
  - Se encontrar: atualiza apenas campos vazios (não sobrescreve dados já preenchidos pelo usuário)
  - Se não encontrar: cria novo cliente com `name = pushName`, `whatsapp = número`, `lead_source = 'whatsapp'`
- Retorna resumo: `{ total_contacts, created, updated, skipped, errors }`
- JWT verificado (requer autenticação), resolve `clinic_id` via token do usuário
- Secrets usados: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` (já configurados)

#### 2. Atualizar `supabase/config.toml`

Adicionar configuração para a nova function:
```toml
[functions.sync-evolution-contacts]
verify_jwt = true
```

#### 3. Frontend: Botão de sincronização no `ClientesModule.tsx`

- Adicionar botão "Sincronizar WhatsApp" ao lado de "Novo Cliente"
- Ao clicar, chama `supabase.functions.invoke("sync-evolution-contacts")`
- Mostra loading spinner durante a sincronização
- Exibe toast com resumo (criados, atualizados, ignorados)
- Invalida a query de clientes para recarregar a lista

### Lógica de matching de números

O `remoteJid` vem como `5511999998888@s.whatsapp.net`. Extraímos apenas os dígitos. Para comparar com o campo `whatsapp` na tabela `clients` (que pode ter formatação variada como `(11) 99999-8888`), a edge function faz a comparação por sufixo dos últimos 10-11 dígitos (sem DDI).

### Nenhuma mudança no banco

A tabela `clients` já tem todos os campos necessários (`name`, `whatsapp`, `phone`, `lead_source`).

