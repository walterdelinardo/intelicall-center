

## Plano: Visualização mensal com grade de horários no módulo Agenda

### Situação atual
O AgendaModule tem apenas visualizações "Dia" e "Semana". Não existe visão mensal. A visão diária mostra eventos como cards empilhados, sem grade de horários — impossível ver horários livres ou clicar em um horário vazio para criar evento.

### Mudanças no `AgendaModule.tsx`

#### 1. Adicionar view "month" ao TabsTrigger
- Adicionar `<TabsTrigger value="month">Mês</TabsTrigger>` junto com "Dia" e "Semana"
- Atualizar o estado `view` para aceitar `"day" | "week" | "month"`
- Atualizar a navegação (`navigate`) para avançar/retroceder por mês quando `view === "month"`

#### 2. Visão mensal — calendário com indicadores de eventos
- Grid 7 colunas, similar ao CalendarTab existente mas integrado no módulo Agenda
- Cada célula mostra o número do dia + dots indicando eventos
- Ao clicar num dia, muda para `view = "day"` naquele dia (drill-down)
- Header do mês com navegação (mês/ano em pt-BR)

#### 3. Melhorar visão diária — Grade de horários (time grid)
- Substituir a lista simples de cards por uma grade vertical de horários (07:00–21:00, intervalos de 30min)
- Cada slot de horário ocupa uma linha fixa
- Eventos posicionados nos slots correspondentes ao seu horário
- Slots vazios são clicáveis → abre o dialog de criação com data e horário pré-preenchidos
- Visual: coluna de horas à esquerda, área de eventos à direita

#### 4. Melhorar visão semanal — Grade de horários por dia
- Manter grid 7 colunas, mas adicionar eixo vertical de horários (07:00–21:00)
- Eventos posicionados por horário em cada coluna
- Slots vazios clicáveis para criar evento rápido

#### 5. Criar evento ao clicar em slot vazio
- Ao clicar num horário vazio, pré-preencher `form.date` e `form.start_time` com o horário clicado
- Abrir automaticamente o dialog de criação

### Estrutura visual

```text
Visão Mês:
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Seg │ Ter │ Qua │ Qui │ Sex │ Sáb │ Dom │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│  1  │  2  │  3● │  4  │  5●●│  6  │  7  │
│  8  │  9  │ 10  │ 11● │ 12  │ 13  │ 14  │
│ ... │     │     │     │     │     │     │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘
  (clicar no dia → vai pra visão Dia)

Visão Dia (grade de horários):
┌──────┬──────────────────────────────────┐
│07:00 │                                  │ ← clicável
│07:30 │                                  │
│08:00 │ ┌─ Consulta João ─────────────┐  │
│08:30 │ └─────────────────────────────┘  │
│09:00 │                                  │ ← clicável
│09:30 │ ┌─ Retorno Maria ─────────────┐  │
│10:00 │ └─────────────────────────────┘  │
│...   │                                  │
└──────┴──────────────────────────────────┘
```

### Arquivos alterados
- `src/components/modules/AgendaModule.tsx` — todas as mudanças concentradas aqui

### Imports adicionais necessários
- `startOfMonth`, `endOfMonth`, `addMonths`, `subMonths` do date-fns (já disponíveis)

