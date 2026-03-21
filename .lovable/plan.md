## Plano: Vincular appointments ao Google Calendar via `google_event_id` ✅ IMPLEMENTADO

### Mudanças realizadas

1. **Migration**: Adicionada coluna `google_event_id text` + índice na tabela `appointments`
2. **AgendaModule.tsx**:
   - `google_event_id` salvo ao criar appointment no billing (principal e extras)
   - Verificação de duplicidade agora usa `google_event_id` em vez de `description + date`
   - Transações de procedimentos extras vinculadas ao `appointment_id` correto
   - Appointments filhos (`parent_appointment_id IS NOT NULL`) filtrados do grid local
   - Status update simplificado usando IDs conhecidos em vez de query por notes
3. **Backfill**: Appointments existentes de 21/03 atualizados com `google_event_id = 'je09pfdegjhbcot631ukf9l3qg'`
