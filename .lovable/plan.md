

## Plano: Vincular Google Calendar a instâncias WhatsApp + cores e etiquetas nas conversas

### Resumo
Adicionar um campo `google_calendar_account_id` na tabela `whatsapp_inboxes` para vincular cada instância a uma conta Google Calendar. Usar a cor da agenda vinculada como indicador visual nas conversas, e mostrar uma etiqueta com o label da instância quando o filtro estiver em "Todas as caixas".

### Alterações

#### 1. Migração: adicionar coluna `google_calendar_account_id` em `whatsapp_inboxes`
```sql
ALTER TABLE public.whatsapp_inboxes 
ADD COLUMN google_calendar_account_id uuid REFERENCES public.google_calendar_accounts(id) ON DELETE SET NULL;
```

#### 2. `ConfiguracoesModule.tsx` — Seletor de agenda na tabela de instâncias WhatsApp
Adicionar uma coluna "Agenda" na tabela de instâncias WhatsApp com um `Select` que lista as contas Google Calendar ativas. Ao selecionar, faz update na coluna `google_calendar_account_id`.

#### 3. `ConversationList.tsx` — Cor e etiqueta da instância
- Receber como prop um mapa `inboxId -> { label, color }` construído no `ChatTab`.
- Usar a cor como borda lateral ou bolinha colorida discreta no item da conversa.
- Quando `selectedInboxId` for `null` (todas as caixas), mostrar uma etiqueta pequena com o label da instância ao lado do status.

#### 4. `ChatTab.tsx` — Montar mapa de cores e passar para ConversationList
- Fazer query das `whatsapp_inboxes` com join em `google_calendar_accounts` para obter a cor.
- Construir mapa `{ [inbox_id]: { label, color } }` e passar como prop.
- Passar `selectedInboxId` para que ConversationList saiba quando mostrar etiquetas.

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar `google_calendar_account_id` em `whatsapp_inboxes` |
| `src/components/modules/ConfiguracoesModule.tsx` | Coluna "Agenda" com seletor na tabela de instâncias |
| `src/components/dashboard/ChatTab.tsx` | Query de cores, montar mapa, passar props |
| `src/components/dashboard/chat/ConversationList.tsx` | Exibir cor + etiqueta da instância |

