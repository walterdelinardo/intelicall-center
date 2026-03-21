

## Plano: Corrigir vínculos de dados no banco

### Dados identificados

**Appointments (seq 4 e 5 sem parent):**
- Seq 4 (`be0c0509`) e Seq 5 (`d4920517`) foram criados como extras do Seq 3 (`070d1b70`) mas estão sem `parent_appointment_id`

**Transações financeiras:**
- `d2ca6ee4` (extra Tratamento R$120) — sem `appointment_id`, deveria apontar para seq 4 (`be0c0509`)
- `6c800cb5` (extra limpeza R$125) — sem `appointment_id`, deveria apontar para seq 5 (`d4920517`)
- `86c8a93e` (R$120, pendente) — **duplicata** gerada pelo trigger, deletar
- `504a666d` (R$125, pendente) — **duplicata** gerada pelo trigger, deletar

### Correções (4 statements SQL)

```sql
-- 1. Vincular seq 4 e 5 ao evento principal (seq 3)
UPDATE appointments SET parent_appointment_id = '070d1b70-d9db-4d8a-9b0f-271720cbf186'
WHERE id IN ('be0c0509-a84d-421f-9975-57c5426d6382', 'd4920517-0d72-41e0-8d9b-96520cbbaa19');

-- 2. Vincular transação extra Tratamento ao seq 4
UPDATE financial_transactions SET appointment_id = 'be0c0509-a84d-421f-9975-57c5426d6382'
WHERE id = 'd2ca6ee4-0c58-4f59-ae3c-2e262584d9a6';

-- 3. Vincular transação extra limpeza ao seq 5
UPDATE financial_transactions SET appointment_id = 'd4920517-0d72-41e0-8d9b-96520cbbaa19'
WHERE id = '6c800cb5-6507-43bb-921b-5d65562c60df';

-- 4. Deletar transações duplicadas do trigger
DELETE FROM financial_transactions
WHERE id IN ('86c8a93e-8d14-4e72-b8c5-1a32c576f990', '504a666d-b481-4535-bc96-345578a593d1');
```

### Resultado esperado

| Agendamento | Parent | Evento visual |
|-------------|--------|---------------|
| Seq 3 (Tratamento) | NULL | Evento #3 (principal) |
| Seq 4 (Tratamento extra) | Seq 3 | Evento #3 |
| Seq 5 (limpeza extra) | Seq 3 | Evento #3 |

Transações financeiras do evento #3: 3 transações (R$120 + R$120 + R$125 = R$365), todas vinculadas aos seus respectivos appointments, sem duplicatas.

