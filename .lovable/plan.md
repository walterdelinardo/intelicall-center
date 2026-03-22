

## Correção da margem direita cortada na lista de chats

### Problema
O ScrollArea do Radix UI posiciona a barra de rolagem **sobre** o conteúdo no lado direito. O padding interno atual (`p-1.5 sm:p-2`) não compensa esse espaço, fazendo com que o texto e os cards sejam cortados na borda direita.

### Solução
Adicionar padding-right extra no container interno do ScrollArea para compensar a largura da barra de rolagem (~10px / `w-2.5`).

### Arquivo a alterar
**`src/components/dashboard/chat/ConversationList.tsx`** (linha 102):
- Trocar `p-1.5 sm:p-2` por `p-1.5 pr-3 sm:p-2 sm:pr-4` no div interno que envolve os cards da lista.

Isso garante que o conteúdo tenha espaço suficiente à direita para não ser sobreposto pela barra de rolagem, mantendo o padding uniforme nos outros lados.

