

## Plano: Corrigir popover de notificações + adicionar botão "Importante"

### Problemas identificados
1. O popover de notificações no cabeçalho está com largura insuficiente (`w-80` = 320px), cortando os botões de ação
2. Falta o botão "Importante" (com ícone `!`) em ambos os locais (cabeçalho e aba Notificações)
3. O ícone de "lida" usa `Eye`/`XCircle` em vez de ✅ (Check)
4. Os dois botões (lida + importante) precisam caber sem cortar

### Mudanças

#### 1. Migration: adicionar coluna `is_important`
```sql
ALTER TABLE public.calendar_notifications ADD COLUMN is_important boolean NOT NULL DEFAULT false;
```

#### 2. DashboardHeader.tsx
- Aumentar largura do popover de `w-80` para `w-96` (384px)
- Trocar ícone de lida: `Eye`/`XCircle` → `CircleCheck` (verde quando lida) 
- Adicionar botão "Importante": ícone `AlertCircle` (amarelo/laranja quando marcada)
- Ambos os botões lado a lado, compactos (`h-6 w-6`)
- Notificações marcadas como importantes com indicador visual (borda ou ícone destacado)

#### 3. AgendaModule.tsx (aba Notificações)
- Mesma lógica: trocar ícones de lida para ✅ (`CircleCheck`)
- Adicionar botão "Importante" com `AlertCircle` (!)
- Ambos os botões de ação lado a lado

#### 4. Ícones usados
- **Lida**: `CircleCheck` do lucide-react (✅ semântico) — verde quando marcada
- **Importante**: `AlertCircle` do lucide-react (!) — amarelo/laranja quando marcada

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | `ADD COLUMN is_important boolean DEFAULT false` |
| `DashboardHeader.tsx` | Popover maior, botões lida (✅) e importante (!), ícones corretos |
| `AgendaModule.tsx` | Botões lida (✅) e importante (!) na aba notificações |

