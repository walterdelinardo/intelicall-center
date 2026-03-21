

## Plano: Usar `seq_number` para agrupar eventos

### Problema
Atualmente o agrupamento de procedimentos no prontuário usa `date + start_time` como chave. O correto é usar o `seq_number` (SERIAL) que já existe na tabela `appointments`.

### Correções

**Arquivo: `src/components/modules/ProntuariosModule.tsx`**

1. **Query de appointments** (linha 597): adicionar `seq_number` no select:
   - De: `"*, procedures(name, price, duration_minutes)"`
   - Para: `"*, procedures(name, price, duration_minutes)"` (seq_number já vem no `*`, mas confirmar uso)

2. **Agrupamento** (linhas 624-630): trocar chave de `date_start_time` para `seq_number`:
   - Appointments do mesmo evento compartilham o mesmo `seq_number`? **Não** — cada appointment tem seu próprio `seq_number` (é SERIAL auto-incremento por linha).

### Problema de design
O `seq_number` é um ID sequencial **por appointment**, não por evento. Appointments extras criados no billing recebem `seq_number` diferentes do principal. Para agrupar por evento, precisamos de uma referência ao evento principal.

**Duas opções:**
- **Opção A**: Adicionar coluna `parent_appointment_id` na tabela appointments para vincular extras ao principal, e agrupar por `COALESCE(parent_appointment_id, id)`. Usar o `seq_number` do appointment principal como identificador visual do evento.
- **Opção B**: Manter agrupamento por `date + start_time` mas exibir o `seq_number` do primeiro appointment do grupo como ID visual do evento.

### Recomendação: Opção A (parent_appointment_id)

**Migration:**
```sql
ALTER TABLE public.appointments ADD COLUMN parent_appointment_id uuid REFERENCES public.appointments(id);
```

**AgendaModule.tsx (BillingDialog):** Ao criar appointments extras, setar `parent_appointment_id` com o ID do appointment principal.

**ProntuariosModule.tsx:**
- Agrupar por `COALESCE(appt.parent_appointment_id, appt.id)` — todos os extras ficam no grupo do principal
- Exibir `Evento #${mainAppt.seq_number}` como identificador visual
- Ordenar por `seq_number` desc

**FinanceiroModule.tsx:** Já usa `seq_number` corretamente. Para transações de produtos vinculadas a extras, o `seq_number` do pai será visível via o appointment principal.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| **Migration** | `ADD COLUMN parent_appointment_id uuid` |
| `AgendaModule.tsx` | Setar `parent_appointment_id` nos extras do billing |
| `ProntuariosModule.tsx` | Agrupar por parent/self; mostrar `Evento #seq_number` |

