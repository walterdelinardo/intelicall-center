
CREATE TABLE public.google_oauth_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE UNIQUE,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_oauth_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their clinic google config"
ON public.google_oauth_config
FOR ALL
TO authenticated
USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
