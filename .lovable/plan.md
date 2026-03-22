
Objetivo: corrigir a área lateral da lista de chats do módulo Conversas para que os cards respeitem a caixa pai, tenham margens internas consistentes e o corte de texto fique responsivo sem “encostar” na borda.

Plano de implementação

1. Ajustar o container do módulo de conversas
- Em `ChatTab.tsx`, aplicar `min-w-0` e `min-h-0` no grid e nos dois cards.
- Garantir que a coluna esquerda possa encolher corretamente dentro do layout sem forçar overflow horizontal.

2. Fazer a lista obedecer a área disponível
- Em `ConversationList.tsx`, aplicar `min-w-0 min-h-0` no wrapper principal e no `ScrollArea`.
- Remover o efeito de “lista colada na borda” criando um wrapper interno com padding responsivo (`p-2 sm:p-3`) dentro da área rolável.

3. Corrigir a composição visual dos cards
- Trocar a pilha atual baseada em `divide-y` por uma lista com espaçamento controlado entre cards.
- Deixar cada item com largura contida (`w-full max-w-full`), padding interno consistente e cantos arredondados para reforçar a margem visual.
- Manter o indicador de agenda/inbox sem deixar o card parecer cortado na lateral.

4. Corrigir o corte da última mensagem
- Reorganizar a linha de nome/hora e o bloco de conteúdo com `min-w-0` nos elementos certos.
- Deixar o nome ocupar o espaço flexível e a hora/data fixa no canto superior direito.
- Garantir que a última mensagem use ellipsis real dentro do espaço restante, sem ficar escondida pela borda ou pela barra de rolagem.

5. Tornar responsivo
- Em telas menores, reduzir padding/gaps dos cards e manter a lista adaptada à largura da coluna.
- Validar que desktop, tablet e mobile preservem: margem interna, alinhamento do horário e truncamento correto.

Arquivos a ajustar
- `src/components/dashboard/ChatTab.tsx`
- `src/components/dashboard/chat/ConversationList.tsx`

Detalhes técnicos
- O problema principal não parece ser global; ele vem da combinação de grid/flex + `ScrollArea` + itens full width sem padding interno suficiente.
- A correção será localizada no módulo de conversas para não afetar outros usos do componente compartilhado `ScrollArea`.
- Só considerarei mexer em `src/components/ui/scroll-area.tsx` se, após a correção local, a barra de rolagem ainda estiver sobrepondo o conteúdo.
