

## Diagnóstico: Evento das 20h não aparece

**Causa raiz**: A Edge Function `google-calendar-events` busca eventos com `maxResults=50` (linha 68) numa janela de 120 dias (90 passados + 30 futuros). Quando há mais de 50 eventos nesse período, a API do Google retorna apenas os 50 primeiros (ordenados por `startTime`), cortando os últimos — incluindo o das 20h.

## Correção

### 1. `supabase/functions/google-calendar-events/index.ts` — Aumentar limite e paginar

- Aumentar `maxResults` para `2500` (máximo da API do Google)
- Implementar paginação via `nextPageToken` para garantir que todos os eventos sejam retornados, mesmo que ultrapassem 2500
- Manter a janela de 90+30 dias

**Trecho da mudança (linha 68)**:
```
maxResults=2500
```

Com loop de paginação:
```typescript
let allItems: any[] = [];
let pageToken = '';
do {
  const url = `...&maxResults=2500${pageToken ? `&pageToken=${pageToken}` : ''}`;
  const response = await fetch(url, ...);
  const data = await response.json();
  allItems.push(...(data.items || []));
  pageToken = data.nextPageToken || '';
} while (pageToken);
```

### Arquivo alterado
- `supabase/functions/google-calendar-events/index.ts` (paginação na listagem)

