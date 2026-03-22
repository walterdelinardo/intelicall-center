

## Plano: Trocar "Encerrar" por "Ocultar" (sem novo status/coluna)

Reutilizar o status `encerrado` existente como mecanismo de ocultação. Conversas com `conversation_status = 'encerrado'` ficam ocultas da lista principal e visíveis numa aba separada.

### Mudanças

#### 1. `useWhatsApp.ts` — Filtrar ocultos por padrão
- Adicionar flag `showHidden` ao `ConversationFilters`
- Quando `showHidden = false` (padrão): excluir `conversation_status = 'encerrado'`
- Quando `showHidden = true`: filtrar apenas `conversation_status = 'encerrado'`
- Renomear `closeConversation` para `hideConversation` (mesma lógica)
- Adicionar `unhideConversation` que muda status de `encerrado` para `bot`

#### 2. `ChatArea.tsx` — Renomear botão
- Trocar label "Encerrar" → "Ocultar"
- Trocar ícone `XCircle` → `EyeOff`
- Adicionar botão "Desocultar" (`Eye`) quando conversa está oculta (status `encerrado`)
- Renomear `handleClose` → `handleHide`

#### 3. `ChatTab.tsx` — Toggle de ocultos
- Adicionar estado `showHidden` (boolean, default false)
- Passar `showHidden` para o hook `useWhatsAppConversations`
- Adicionar botão/toggle no header do painel de conversas para alternar entre "Conversas" e "Ocultas"

#### 4. `ConversationList.tsx` — Remover "Encerrado" do filtro de status
- Remover opção "Encerrado" do select de status (já que ocultos têm aba própria)
- Quando em modo ocultos, mostrar botão "Desocultar" (ícone `Eye`) em cada item

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `useWhatsApp.ts` | Flag `showHidden`, filtro, rename close→hide, add unhide |
| `ChatArea.tsx` | Botão "Ocultar" com `EyeOff`, botão "Desocultar" com `Eye` |
| `ChatTab.tsx` | Toggle para ver conversas ocultas |
| `ConversationList.tsx` | Remover "Encerrado" do filtro, botão desocultar em modo ocultos |

Nenhuma migration necessária — reutiliza o status `encerrado` existente.

