
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS google_maps_api_key text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS cnpj text;

CREATE TABLE IF NOT EXISTS public.calendar_notifications (
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

ALTER TABLE public.waiting_list ADD COLUMN IF NOT EXISTS google_calendar_account_id uuid REFERENCES public.google_calendar_accounts(id) ON DELETE SET NULL;
