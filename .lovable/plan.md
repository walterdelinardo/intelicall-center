

## Corrigir Layout do Módulo Conversas — 2 Colunas

### Problema
O layout usa `lg:grid-cols-[...]` (breakpoint 1024px), mas a viewport do dashboard é ~888px, então cai no layout de 1 coluna e empilha o chat abaixo da lista.

### Solução

**Arquivo: `src/components/dashboard/ChatTab.tsx`** (linha 133)

Trocar `lg:grid-cols-[minmax(320px,420px)_1fr]` por `md:grid-cols-[minmax(300px,380px)_1fr]` para ativar 2 colunas a partir de 768px. Em mobile (<768px), mantém coluna única.

Alterar de:
```
grid grid-cols-1 lg:grid-cols-[minmax(320px,420px)_1fr]
```
Para:
```
grid grid-cols-1 md:grid-cols-[minmax(300px,380px)_1fr]
```

Reduzir ligeiramente o tamanho máximo da lista (380px em vez de 420px) para dar mais espaço ao chat na viewport de ~888px.

