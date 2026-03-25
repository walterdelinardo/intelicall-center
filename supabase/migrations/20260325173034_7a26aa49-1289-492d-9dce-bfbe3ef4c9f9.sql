CREATE TABLE public.instance_downtime_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  inbox_id uuid NOT NULL REFERENCES public.whatsapp_inboxes(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  down_at timestamptz NOT NULL DEFAULT now(),
  up_at timestamptz,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instance_downtime_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view downtime logs in their clinic"
  ON public.instance_downtime_logs FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Service role full access downtime logs"
  ON public.instance_downtime_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);