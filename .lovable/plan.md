

## Plano: 5 melhorias — Google Maps config, notificações agenda, cabeçalho, agenda na lista de espera, auto-agendamento

---

### 1. Seção Google Maps API na aba Integrações (ConfiguracoesModule)

Adicionar uma terceira `Card` na `TabsContent value="integrations"` com campo para inserir a chave da API Google Maps. Salvar como secret via `add_secret` ou em uma coluna na tabela `clinics` (campo `google_maps_api_key`). Como é uma chave privada usada na edge function, armazenar como secret e exibir apenas um indicador de "configurada/não configurada".

- Adicionar coluna `google_maps_api_key` em `clinics` (para controle de UI — saber se está configurada)
- Card com input mascarado, botão salvar, e indicador de status
- Ao salvar, atualizar na tabela `clinics` e usar `add_secret` para a edge function

**Revisão**: Já existe o secret `GOOGLE_CALENDAR_API_KEY`. O Google Maps usa uma chave separada. Vou criar um campo na tabela `clinics` para indicar status e usar um novo secret `GOOGLE_MAPS_API_KEY`.

**Migração SQL**:
```sql
ALTER TABLE public.clinics ADD COLUMN google_maps_api_key text;
```

**Arquivo**: `src/components/modules/ConfiguracoesModule.tsx`

---

### 2. Aba Notificações no módulo Agenda

**Migração SQL** — Nova tabela `calendar_notifications`:
```sql
CREATE TABLE public.calendar_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  account_id uuid REFERENCES public.google_calendar_accounts(id) ON DELETE SET NULL,
  event_id text,
  event_title text,
  action text NOT NULL, -- 'created', 'updated', 'rescheduled', 'cancelled'
  details text,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view notifications in their clinic"
  ON public.calendar_notifications FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can insert notifications in their clinic"
  ON public.calendar_notifications FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Service role full access notifications"
  ON public.calendar_notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

- Adicionar `TabsTrigger "notificacoes"` no `AgendaModule`
- Quando exibida, query `calendar_notifications` ordenadas por `created_at DESC` com limite 50
- Ao criar/editar/cancelar/excluir evento no `AgendaModule`, inserir registro em `calendar_notifications`
- Ícones diferentes por tipo de ação (criado, reagendado, cancelado, atualizado)

**Arquivos**: `src/components/modules/AgendaModule.tsx`, migração SQL

---

### 3. Cabeçalho do sistema (DashboardHeader refeito)

Reescrever `DashboardHeader.tsx` e integrá-lo no `Dashboard.tsx`:

- **Esquerda**: Logo da clínica (`clinic.logo_url` ou ícone padrão), nome da clínica, endereço, CNPJ
- **Direita**: Nome do usuário logado + seus papéis (badges), ícone de notificações com dropdown das últimas 10 `calendar_notifications`, botão de logoff
- O dropdown de notificações usa `Popover` com lista scrollável
- Dados vêm de `useAuth()` (profile, roles) e query `clinics`

**Migração SQL**: Adicionar coluna `cnpj` em `clinics`:
```sql
ALTER TABLE public.clinics ADD COLUMN cnpj text;
```

Adicionar campo CNPJ na aba "Clínica" do ConfiguracoesModule.

**Arquivos**: `src/components/dashboard/DashboardHeader.tsx`, `src/pages/Dashboard.tsx`, `src/components/modules/ConfiguracoesModule.tsx`

---

### 4. Trocar "Profissional" por "Agenda" no formulário da Lista de Espera

No formulário de criar/editar da `ListaEsperaModule`:
- Substituir o `Select` de `professional_id` (profiles) por um `Select` de `google_calendar_account_id` (google_calendar_accounts ativas)
- Alterar o campo `professional_id` no form para `calendar_account_id`
- Manter a coluna `professional_id` na tabela (não remover, pode ser null)

**Migração SQL**: Adicionar coluna para armazenar a agenda selecionada:
```sql
ALTER TABLE public.waiting_list ADD COLUMN google_calendar_account_id uuid REFERENCES public.google_calendar_accounts(id) ON DELETE SET NULL;
```

**Arquivo**: `src/components/modules/ListaEsperaModule.tsx`

---

### 5. Obrigar data/horário e auto-agendar ao salvar na Lista de Espera

No `saveMutation` da `ListaEsperaModule`:
- Validar que `desired_date`, `time_range_start` e `calendar_account_id` estão preenchidos antes de salvar
- Após inserir na `waiting_list`, criar automaticamente o evento no Google Calendar usando `createGoogleEvent` do hook `useGoogleCalendar`
- Usar os dados do formulário (nome do cliente, procedimento, data, horário) para montar o evento
- Marcar o status como "agendado" automaticamente após criação bem-sucedida

**Arquivo**: `src/components/modules/ListaEsperaModule.tsx`

---

### Resumo de migrações

```sql
ALTER TABLE public.clinics ADD COLUMN google_maps_api_key text;
ALTER TABLE public.clinics ADD COLUMN cnpj text;

CREATE TABLE public.calendar_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  account_id uuid REFERENCES public.google_calendar_accounts(id) ON DELETE SET NULL,
  event_id text,
  event_title text,
  action text NOT NULL,
  details text,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view notifications in their clinic" ON public.calendar_notifications FOR SELECT TO authenticated USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can insert notifications in their clinic" ON public.calendar_notifications FOR INSERT TO authenticated WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Service role full access notifications" ON public.calendar_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.waiting_list ADD COLUMN google_calendar_account_id uuid REFERENCES public.google_calendar_accounts(id) ON DELETE SET NULL;
```

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | `clinics` + `calendar_notifications` + `waiting_list` |
| `src/components/dashboard/DashboardHeader.tsx` | Cabeçalho completo com logo, dados da clínica, usuário, notificações, logoff |
| `src/pages/Dashboard.tsx` | Integrar novo DashboardHeader |
| `src/components/modules/AgendaModule.tsx` | Aba notificações, registrar ações em `calendar_notifications` |
| `src/components/modules/ConfiguracoesModule.tsx` | Seção Google Maps API + campo CNPJ |
| `src/components/modules/ListaEsperaModule.tsx` | Trocar profissional por agenda, validar data/horário, auto-agendar |

