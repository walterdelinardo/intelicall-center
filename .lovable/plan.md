

## Ajuste responsivo do painel de conversas

O problema é que o layout usa `grid-cols-3` fixo no `lg`, o que faz o painel esquerdo ficar estreito demais e cortar o conteúdo dos cards. Além disso, o nome do contato e a label da inbox podem ultrapassar o espaço disponível.

### Mudanças

#### 1. `ChatTab.tsx` — Ajustar proporções do grid
- Trocar `grid-cols-1 lg:grid-cols-3` por `grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_2fr]` para garantir largura mínima de 320px no painel de conversas e proporção responsiva.

#### 2. `ConversationList.tsx` — Garantir que todo conteúdo respeite os limites
- Adicionar `overflow-hidden` no `<button>` de cada card para evitar que conteúdo vaze.
- Garantir que a linha de status/badges também tenha `overflow-hidden` e `flex-nowrap` com truncamento quando necessário.
- Adicionar `truncate` na label da inbox para não estourar o card.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `ChatTab.tsx` | Grid com `minmax` para largura mínima responsiva |
| `ConversationList.tsx` | `overflow-hidden` no card, truncamento na inbox label |

