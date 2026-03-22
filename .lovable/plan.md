

## Ajustes na lista de conversas

O código atual já posiciona o horário/data no canto superior direito do card e usa a classe `truncate` para a última mensagem. No entanto, podem existir questões de overflow que impedem o truncamento correto.

### Mudanças em `ConversationList.tsx`

1. **Horário/data** — já está no canto superior direito (linha 123-133). Sem alteração necessária.

2. **Última mensagem com ellipsis** — garantir que a classe `truncate` funcione corretamente adicionando `overflow-hidden` no container pai e assegurando `max-w` adequado. A classe `truncate` do Tailwind já aplica `text-overflow: ellipsis`, mas o container precisa ter largura limitada para funcionar. Adicionar `max-w-full` ou garantir que `min-w-0` + `flex-1` estejam aplicados corretamente no wrapper.

### Arquivo afetado
| Arquivo | Mudança |
|---------|---------|
| `ConversationList.tsx` | Garantir truncamento com ellipsis na última mensagem |

