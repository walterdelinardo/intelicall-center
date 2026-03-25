

## Corrigir nome do contato nas conversas do WhatsApp

### Problema
Na Edge Function `evolution-webhook`, o campo `contact_name` da conversa é atualizado em **todas** as mensagens, inclusive as enviadas (`isFromMe=true`). Quando a clínica envia uma mensagem, o `pushName` do payload é o nome do próprio remetente (a clínica), sobrescrevendo o nome real do cliente com algo como "Você" ou o nome da empresa.

### Solução

**Arquivo: `supabase/functions/evolution-webhook/index.ts`**

1. **Só atualizar `contact_name` em mensagens recebidas** (linhas 551-554): Condicionar a inclusão de `contact_name` no update da conversa apenas quando `isFromMe === false` e `contactName` não estiver vazio.

2. **Ao criar conversa nova com mensagem enviada**, usar `contactPhone` como fallback em vez do pushName da clínica.

Lógica proposta:
```typescript
const conversationUpdate: Record<string, any> = {
  contact_phone: contactPhone,
  is_group: isGroup,
  last_message: lastMessagePreview,
  last_message_at: new Date().toISOString(),
  status: "active",
};

// Só atualizar contact_name com pushName de mensagens recebidas (do cliente)
if (!isFromMe && contactName) {
  conversationUpdate.contact_name = contactName;
} else if (!isFromMe) {
  conversationUpdate.contact_name = contactPhone;
}

const conv = await findOrCreateConversation(
  supabase, clinicId, inboxId, remoteJid, conversationUpdate
);
```

3. **No `findOrCreateConversation`**, ao criar conversa nova (INSERT), garantir que `contact_name` tenha pelo menos o `contactPhone` como valor padrão, já que o campo precisa existir na criação.

### Resultado
- Mensagens enviadas pela clínica não sobrescrevem mais o nome do cliente
- Novos contatos recebem o pushName do WhatsApp corretamente
- Se a primeira interação for uma mensagem enviada, o contato aparece com o número até receber uma mensagem do cliente com pushName

