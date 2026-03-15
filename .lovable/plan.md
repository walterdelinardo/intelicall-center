

## Plano: Melhorar Módulo Agenda com Sincronização Google Calendar Multi-Conta

### Contexto

Atualmente o módulo Agenda usa apenas a tabela local `appointments`. Existem hooks (`useGoogleCalendar`, `useGoogleOAuth`) e edge functions (`google-calendar-events`, `google-oauth-callback`) para Google Calendar, mas suportam apenas uma conta por usuário via `google_oauth_tokens`. O objetivo é permitir múltiplas contas Google Calendar por clínica (como as instâncias WhatsApp) e sincronizar eventos no módulo Agenda.

### Mudanças

#### 1. Nova tabela `google_calendar_accounts` (migration)

Modelo similar a `whatsapp_inboxes`:

```sql
CREATE TABLE public.google_calendar_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Principal',
  calendar_id text NOT NULL DEFAULT 'primary',
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  scope text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_accounts ENABLE ROW LEVEL SECURITY;

-- RLS: clinic members can view, admins can manage
CREATE POLICY "Users can view calendar accounts in their clinic"
  ON public.google_calendar_accounts FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Admins can manage calendar accounts"
  ON public.google_calendar_accounts FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
```

A tabela `google_oauth_tokens` existente continua funcionando, mas a nova lógica usará `google_calendar_accounts` que armazena os tokens junto com metadados da clínica (label, calendar_id).

#### 2. Atualizar Edge Function `google-oauth-callback`

- Receber `clinic_id` e `label` no parâmetro `state` (JSON encoded)
- Após receber tokens, inserir/upsert em `google_calendar_accounts` em vez de `google_oauth_tokens`
- Redirecionar de volta com parâmetro de sucesso

#### 3. Atualizar Edge Function `google-calendar-events`

- Receber `account_id` no body para identificar qual conta usar
- Buscar tokens de `google_calendar_accounts` em vez de `google_oauth_tokens`
- Usar o `calendar_id` da conta (não mais fixo em `primary`)
- Manter lógica de refresh de token existente, atualizando na nova tabela

#### 4. Atualizar `useGoogleOAuth` hook

- Refatorar para trabalhar com múltiplas contas
- `initiateOAuth` recebe `label` e envia `clinic_id + label` no state
- `checkConnection` → `fetchAccounts` retorna lista de contas
- `disconnect` recebe `account_id`

#### 5. Atualizar `useGoogleCalendar` hook

- `fetchEvents` recebe `account_id` opcional; se não informado, busca de todas as contas ativas
- Eventos retornados incluem `account_label` para identificar a origem
- CRUD de eventos recebe `account_id` para saber qual conta usar

#### 6. Atualizar `AgendaModule.tsx`

- Mostrar eventos do Google Calendar mesclados com agendamentos locais
- Diferenciar visualmente eventos locais vs Google Calendar (badge com label da conta)
- Filtro por conta Google Calendar
- Ao criar evento, opção de também criar no Google Calendar (selecionar conta)
- Sincronização bidirecional: eventos criados localmente podem ser enviados ao Google Calendar

#### 7. Atualizar `ConfiguracoesModule.tsx` — aba Integrações

- Adicionar seção "Google Calendar" abaixo de "WhatsApp"
- Interface igual à de WhatsApp inboxes: tabela com Label, Calendar ID, Status, botões Ativar/Desativar/Excluir
- Botão "Conectar Google Calendar" abre OAuth flow passando label
- Listar contas conectadas da clínica

### Fluxo do OAuth Multi-Conta

```text
[Configurações] → Clica "Conectar Google Calendar"
     → Preenche label (ex: "Dr. João")
     → Redireciona para Google OAuth
     → Callback salva tokens em google_calendar_accounts
     → Volta para /dashboard?google_auth=success
```

### Detalhes Técnicos

- Secrets necessários já existem: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- O `state` do OAuth passará um JSON encoded `{ user_id, clinic_id, label }` em vez de apenas `user_id`
- O `redirect_uri` permanece o mesmo da edge function
- Nenhuma mudança na tabela `appointments` — eventos Google são exibidos em overlay, não persistidos localmente

