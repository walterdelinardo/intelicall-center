ALTER TABLE public.financial_transactions
  ADD COLUMN google_event_id text DEFAULT NULL,
  ADD COLUMN calendar_label text DEFAULT NULL;