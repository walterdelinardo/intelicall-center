

## Plano de Correções — Prontuários, Financeiro, Agenda

### 1. Prontuário único por paciente (corrigir duplicação)

**Problema**: O sistema cria prontuários duplicados — um com dados e outro vazio. Há dois locais que criam medical_records:
- Criação de evento Google Calendar (linha ~404): filtra por `client_id + date` 
- Faturamento (linha ~1762): filtra por `client_id` apenas (sem date)

Ambos deveriam verificar se JÁ EXISTE um prontuário para aquele `client_id` (independente da data), pois a regra é **1 prontuário por paciente**.

**Correção**:
- Em ambos os locais no `AgendaModule.tsx`, alterar a query de verificação para buscar apenas por `client_id + clinic_id` (sem filtrar por `date`)
- Na listagem do `ProntuariosModule.tsx`, agrupar por paciente — a lista principal mostra 1 linha por paciente, não por data

### 2. Aba Procedimentos — agrupar por agendamento

**Problema**: A aba Procedimentos lista cada appointment individualmente. O correto é agrupar todos os appointments que pertencem ao mesmo evento/data em uma única linha, com um botão "Ver Detalhes" que expande os procedimentos e produtos.

**Correção** em `ProntuariosModule.tsx` (ViewRecordInline):
- Agrupar `procedures` (appointments) por `date + start_time` para formar "eventos"
- Mostrar tabela com: Data, Horário, Status, Valor Total do evento
- Botão "Ver Detalhes" abre um Dialog/Collapsible mostrando os procedimentos individuais e produtos vinculados
- Incluir eventos com status `cancelado` na listagem, marcados com badge "Cancelado"
- Mover botões "Anexar Documento" e "Gerar Receita" para dentro do detalhe de cada procedimento

### 3. ID sequencial para agendamentos

**Problema**: Não existe um ID sequencial legível nos appointments para identificar eventos no financeiro.

**Correção**:
- **Migration**: Adicionar coluna `seq_number SERIAL` na tabela `appointments`
- No `FinanceiroModule.tsx` (TxTable / Caixa Diário): 
  - Alterar query para incluir `appointments(seq_number)` via join no `appointment_id`
  - Mostrar coluna "Evento #" na tabela com o `seq_number`
- No `AgendaModule.tsx` (BillingDialog): ao criar transações de venda de produto, vincular o `appointment_id` do evento principal

### 4. Aumentar opacidade dos horários passados + auto-scroll

**Problema**: O overlay dos horários passados usa `bg-foreground/[0.04]` — muito sutil. Não há auto-scroll para o horário atual.

**Correção** em `TimeGrid.tsx`:
- Alterar opacidade do overlay de `bg-foreground/[0.04]` para `bg-foreground/[0.12]` (dia) e `bg-foreground/[0.10]` (semana)
- Adicionar `useEffect` + `useRef` no TimeGrid e WeekTimeGrid para fazer `scrollIntoView` do indicador de hora atual ao montar o componente
- No `AgendaModule.tsx`, envolver o TimeGrid em um container com `overflow-auto` e `ref` para permitir o scroll

### Resumo de arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `AgendaModule.tsx` | Corrigir criação de prontuário (1 por paciente); vincular `appointment_id` em vendas de produto |
| `ProntuariosModule.tsx` | Agrupar procedimentos por evento; incluir cancelados; dialog de detalhes |
| `FinanceiroModule.tsx` | Coluna "Evento #" com seq_number; join com appointments |
| `TimeGrid.tsx` | Aumentar opacidade overlay; auto-scroll para hora atual |
| **Migration** | `ALTER TABLE appointments ADD COLUMN seq_number SERIAL` |

