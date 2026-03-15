

## Plano: Sincronizar edição de cliente com contatos do WhatsApp

### Contexto

O WhatsApp não permite alterar o `pushName` de um contato via API (é controlado pelo próprio usuário). O que podemos fazer é manter a consistência na tabela `whatsapp_conversations`, atualizando `contact_name` e `contact_phone` quando o cliente é editado.

### Mudanças

#### 1. Nova Edge Function `update-whatsapp-contact/index.ts`

Recebe `{ client_id }` e:
- Busca o cliente atualizado na tabela `clients` (nome, whatsapp)
- Normaliza o número (extrai dígitos)
- Busca conversas em `whatsapp_conversations` onde `remote_jid` contém o número do cliente (matching por sufixo dos últimos 11 dígitos) e `clinic_id` é o mesmo
- Atualiza `contact_name` e `contact_phone` nessas conversas
- Retorna `{ updated_conversations: N }`

#### 2. Atualizar `supabase/config.toml`

```toml
[functions.update-whatsapp-contact]
verify_jwt = false
```

#### 3. Frontend: `ClientesModule.tsx`

No `onSuccess` do `saveMutation`, quando for edição e o cliente tiver `whatsapp_inbox_id` (é contato WhatsApp), chamar a edge function em background (fire-and-forget com toast de feedback):

```typescript
if (editClient?.whatsapp_inbox_id) {
  supabase.functions.invoke("update-whatsapp-contact", {
    body: { client_id: editClient.id }
  });
}
```

### Nenhuma mudança no banco

Usa apenas tabelas e colunas existentes (`whatsapp_conversations.contact_name`, `contact_phone`).

