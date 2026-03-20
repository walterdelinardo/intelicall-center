

## Plano: Anotações Internas no Chat (estilo Chatwoot)

### Resumo

Adicionar um toggle no input do chat para alternar entre "Mensagem" e "Nota interna". Notas internas são salvas no banco mas nunca enviadas ao cliente. No corpo do chat, aparecem com visual diferenciado (fundo amarelo, ícone de nota).

---

### 1. Migração de banco

Adicionar coluna `is_internal_note` na tabela `whatsapp_messages`:

```sql
ALTER TABLE public.whatsapp_messages 
ADD COLUMN is_internal_note boolean NOT NULL DEFAULT false;
```

### 2. `useWhatsApp.ts` — Tipo e hook

- Adicionar `is_internal_note` ao tipo `WhatsAppMessage`
- Criar função `sendInternalNote` no hook que insere direto no banco (sem chamar a edge function `send-evolution-message`), com `is_from_me = true`, `message_type = 'text'`, `is_internal_note = true`

### 3. `ChatArea.tsx` — Toggle no input

- Adicionar estado `isNoteMode` (boolean)
- Botão toggle ao lado do input: ícone `StickyNote` quando ativo (amarelo), `MessageSquare` quando desativado
- Quando `isNoteMode = true`:
  - Barra de input muda de cor (borda amarela / fundo amarelo suave)
  - Placeholder muda para "Escreva uma nota interna..."
  - Ao enviar, chama `sendInternalNote` em vez de `sendMessage`
  - Botão de anexo fica desabilitado em modo nota

### 4. `MessageBubble.tsx` — Visual de nota

- Se `msg.is_internal_note === true`, renderizar com estilo diferente:
  - Fundo amarelo (`bg-yellow-100 border border-yellow-300`)
  - Ícone de nota (`StickyNote`) no canto
  - Label "Nota interna" em texto pequeno
  - Alinhado à direita (como mensagens enviadas)

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar `is_internal_note` |
| `src/hooks/useWhatsApp.ts` | Tipo + `sendInternalNote` |
| `src/components/dashboard/chat/ChatArea.tsx` | Toggle nota/mensagem no input |
| `src/components/dashboard/chat/MessageBubble.tsx` | Estilo visual para notas |

