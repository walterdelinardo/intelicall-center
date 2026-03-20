

## Plano: Indicador de hora atual + ofuscamento de horários passados na grade da Agenda

### Alterações

**Arquivo: `src/components/modules/agenda/TimeGrid.tsx`**

Tanto no `TimeGrid` (visão diária) quanto no `WeekTimeGrid` (visão semanal):

#### 1. Linha vermelha indicadora da hora atual
- Calcular a posição Y com base na hora atual em minutos: `((nowMinutes - gridStartMin) / 30) * SLOT_HEIGHT`
- Renderizar uma linha vermelha horizontal absolutamente posicionada com um label "hora atual" centralizado
- Usar `useState` + `useEffect` com `setInterval` de 60s para atualizar em tempo real
- Só exibir a linha se o dia visualizado for hoje

#### 2. Overlay translúcido sobre horários passados
- Calcular a mesma posição Y da hora atual
- Renderizar um `div` absoluto do topo até essa posição com `bg-black/5` (ou similar) e `pointer-events-none` para não bloquear cliques
- Isso cria o efeito de ofuscamento sem impedir interação

#### Estrutura visual da linha:
```text
──── ● hora atual ────────────────────
```
Linha vermelha fina (`h-px bg-red-500`) com label centralizado em texto vermelho pequeno.

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/modules/agenda/TimeGrid.tsx` | Adicionar linha vermelha + overlay em `TimeGrid` e `WeekTimeGrid` |

