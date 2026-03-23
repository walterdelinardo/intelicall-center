

## Remover migração desnecessária

A migração `20260323022604_38c6f835-8d65-4f51-862d-f44ef32a205a.sql` adiciona `'podologo'` ao enum `app_role`, mas esse valor já existe no banco. O código em `ClientesModule.tsx` que filtra profissionais pelo role `'podologo'` já está correto e funcional.

### Ação necessária

1. **Remover o arquivo de migração** `supabase/migrations/20260323022604_38c6f835-8d65-4f51-862d-f44ef32a205a.sql` — ele é redundante pois o role `podologo` já existe no enum `app_role`.

Nenhuma alteração de código é necessária — a lógica de filtragem por `role = 'podologo'` já está implementada corretamente.

