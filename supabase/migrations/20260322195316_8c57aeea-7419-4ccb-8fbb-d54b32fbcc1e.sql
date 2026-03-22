CREATE TABLE public.google_calendar_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.google_calendar_accounts(id) ON DELETE CASCADE,
  sync_token text NOT NULL,
  last_synced_at timestamptz DEFAULT now(),
  UNIQUE(account_id)
);
ALTER TABLE public.google_calendar_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.google_calendar_sync_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);