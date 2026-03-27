

## Plano: Fixar cabeçalhos e adicionar QR Code nas configurações

### 1. Fixar cabeçalho do sistema (`src/pages/Dashboard.tsx`)

O problema: o container pai tem `overflow-auto`, o que faz o `sticky` do DashboardHeader e da barra de título não funcionar corretamente — ambos rolam junto com o conteúdo.

**Solução**: Reestruturar o layout para que o DashboardHeader e a barra de título fiquem fixos, e apenas o `<main>` tenha scroll:

```
div.flex-1.flex.flex-col.h-screen.overflow-hidden
  ├── DashboardHeader (fixo, sem scroll)
  ├── div.barra-titulo (fixo, sem scroll)
  └── main.flex-1.overflow-auto (só aqui rola)
```

Remover `overflow-auto` do container pai e mover para o `<main>`.

### 2. Fixar cabeçalho dos dias na Semana e Mês (Agenda)

**WeekTimeGrid** (`src/components/modules/agenda/TimeGrid.tsx`): O cabeçalho dos dias já tem `sticky top-0 z-20` — funciona porque o container tem `overflow-auto`. Sem alteração necessária.

**MonthView** (`src/components/modules/agenda/MonthView.tsx`): Mudar o container de `overflow-hidden` para `overflow-auto` e adicionar `sticky top-0 z-10` ao cabeçalho dos dias da semana. Como o MonthView pode ser mais alto que a área visível, o sticky garantirá que "Seg Ter Qua..." fique visível ao rolar.

### 3. Adicionar seção QR Code na aba Configurações

**Arquivo**: `src/components/modules/ConfiguracoesModule.tsx`

Adicionar uma nova aba `"whatsapp"` (ou seção dentro de "general") nas Configurações que mostra:
- Lista das instâncias WhatsApp cadastradas (read-only, sem criar/excluir/ativar/desativar)
- Status de conexão (online/offline)
- Botão de **Gerar QR Code** para cada instância

A lógica de `checkInstanceStatus`, `handleGenerateQR`, e o dialog de QR Code já existem no ConfiguracoesModule (aba integrações). Vou reutilizar essa lógica criando uma nova aba "WhatsApp" visível para usuários que não têm acesso a "integrations".

**Detalhes**:
- Nova aba: `"whatsapp"` com ícone Smartphone e título "WhatsApp"
- Conteúdo: Card com tabela simplificada (Label, Status, botão QR Code)
- Sem opções de criar, excluir ou ativar/desativar instâncias
- Reutiliza o mesmo dialog de QR Code já existente

### Arquivos modificados:
1. `src/pages/Dashboard.tsx` — layout fixo
2. `src/components/modules/agenda/MonthView.tsx` — sticky header dias
3. `src/components/modules/ConfiguracoesModule.tsx` — nova aba WhatsApp com QR Code

