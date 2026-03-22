
Objetivo: corrigir de forma estrutural o corte no lado direito da lista de chats, para que a margem direita fique visível, o card respeite a caixa pai e a hora/data apareça sempre no canto superior direito.

Diagnóstico do código
- O problema não está só no item da lista; ele vem da combinação de 3 pontos.
- `Dashboard.tsx`: a cadeia principal de layout usa `flex`, mas o container do conteúdo (`flex-1 flex flex-col overflow-auto`) não tem `min-w-0`. Isso pode fazer filhos internos calcularem largura maior que a área visível.
- `ChatTab.tsx`: a coluna da lista usa `lg:grid-cols-3`, então a largura da coluna esquerda fica “relativa” demais ao espaço total. Em larguras intermediárias, isso aperta o card e empurra primeiro a hora/data.
- `ConversationList.tsx`: a lista ainda depende do `ScrollArea` do Radix, que usa scrollbar sobreposta. Como essa barra pode ficar invisível no sistema/navegador do usuário, ela não é uma referência confiável para margem. Além disso, o wrapper da lista e os cards usam `overflow-hidden`, o que mascara o corte em vez de resolver a largura.

Plano de correção
1. Ajustar a cadeia de largura do dashboard
- Em `src/pages/Dashboard.tsx`, adicionar `min-w-0` no container principal de conteúdo e no `main`.
- Garantir que o módulo de conversas receba uma largura realmente limitada pela área central da tela.

2. Dar uma largura estável para a coluna da lista
- Em `src/components/dashboard/ChatTab.tsx`, trocar `lg:grid-cols-3` por uma grade explícita, por exemplo algo como:
```text
lg:grid-cols-[minmax(320px,420px)_1fr]
```
- Isso garante que a lista tenha largura suficiente para nome + hora/data sem “sumir” no canto direito.

3. Remover a dependência do scrollbar sobreposto
- Em `src/components/dashboard/chat/ConversationList.tsx`, substituir o `ScrollArea` por um container nativo com `overflow-y-auto`.
- Aplicar `min-w-0`, `min-h-0` e `overflow-x-hidden`.
- Reservar espaço consistente para a área rolável com padding interno real, sem depender de uma barra visual que pode nem aparecer.

4. Reforçar a hierarquia de largura dentro de cada card
- No card da conversa, aplicar `min-w-0 w-full` nos wrappers corretos.
- Na linha superior, manter:
  - nome com `flex-1 min-w-0 truncate`
  - hora/data com `shrink-0`
- No bloco da mensagem, manter `truncate`, mas só depois de garantir que todos os pais imediatos têm `min-w-0`.

5. Remover cortes que escondem o problema
- Revisar `overflow-hidden` nos pontos da lista e manter somente onde ele for necessário.
- O card pode continuar com borda arredondada, mas não deve cortar informação do lado direito por causa de um container pai mal dimensionado.

Arquivos a ajustar
- `src/pages/Dashboard.tsx`
- `src/components/dashboard/ChatTab.tsx`
- `src/components/dashboard/chat/ConversationList.tsx`

Resultado esperado
- A margem direita da lista volta a ficar visível.
- Os cards passam a respeitar a largura da caixa pai.
- A hora/data volta a aparecer no canto superior direito.
- O comportamento fica responsivo sem depender da scrollbar do `ScrollArea`.
