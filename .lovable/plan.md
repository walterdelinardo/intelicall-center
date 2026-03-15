

## Plano: Simplificar seletor de cor e adicionar cor personalizada

### Mudanças

#### 1. `useGoogleOAuth.ts` — Simplificar `updateColor`
- Salvar cor diretamente no banco (`google_calendar_accounts.color`) sem chamar a edge function `google-update-calendar-color`
- Remover a chamada à edge function, usar apenas `supabase.update()`

#### 2. `ConfiguracoesModule.tsx` — Usar Popover do Radix e adicionar input de cor personalizada
- Substituir o popover manual (div com `hidden` toggling via DOM) por `<Popover>` + `<PopoverContent>` do Radix (já disponível no projeto)
- Usar `side="top"` ou `sideOffset` para garantir que o popover não fique cortado
- Adicionar um `<input type="color" />` nativo abaixo da paleta predefinida para cor personalizada
- Ao selecionar qualquer cor (paleta ou custom), fechar o popover automaticamente

#### 3. Edge function `google-update-calendar-color` — Manter mas não usar
- Não vamos deletar a edge function, apenas paramos de chamá-la no frontend

### Arquivos alterados
- `src/hooks/useGoogleOAuth.ts`
- `src/components/modules/ConfiguracoesModule.tsx`

