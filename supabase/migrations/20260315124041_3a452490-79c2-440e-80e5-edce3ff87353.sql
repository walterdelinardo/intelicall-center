
CREATE TABLE public.google_calendar_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Principal',
  calendar_id text NOT NULL DEFAULT 'primary',
  user_id uuid NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  scope text NOT NULL DEFAULT 'https://www.googleapis.com/auth/calendar',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calendar accounts in their clinic"
  ON public.google_calendar_accounts FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Admins can insert calendar accounts"
  ON public.google_calendar_accounts FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update calendar accounts"
  ON public.google_calendar_accounts FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete calendar accounts"
  ON public.google_calendar_accounts FOR DELETE TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage all calendar accounts"
  ON public.google_calendar_accounts FOR ALL
  USING (true)
  WITH CHECK (true);
