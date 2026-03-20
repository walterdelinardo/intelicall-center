

## Plano: Tornar a lista de conversas responsiva

### Problema
O layout da linha de cada conversa tem nome, horário, última mensagem, status e badge de não lidos todos na mesma linha. Em telas menores o conteúdo é cortado, escondendo o horário e o status.

### Solução
Reorganizar o layout de cada item de conversa para empilhar as informações em duas linhas claras, garantindo que nada seja cortado:

**Arquivo: `src/components/dashboard/chat/ConversationList.tsx`**

Alterar a estrutura de cada item de conversa (linhas 112-134):

- **Linha 1**: Nome (truncate) + horário (shrink-0) — manter como está, funciona bem
- **Linha 2**: Mudar de layout horizontal para wrap. Colocar a última mensagem em uma linha própria (`block` em vez de `flex-1 truncate` dentro de um flex row). Status e badge de unread ficam abaixo, em uma linha separada com `flex items-center gap-1 mt-0.5`

Layout proposto:
```text
[Avatar]  Nome do contato          14:32
          Última mensagem receb...
          [Status: Humano] [3]
```

Isso garante que status e horário nunca sejam cortados, independente da largura da coluna.

### Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| `src/components/dashboard/chat/ConversationList.tsx` | Reorganizar layout do item para empilhar em 3 linhas |

