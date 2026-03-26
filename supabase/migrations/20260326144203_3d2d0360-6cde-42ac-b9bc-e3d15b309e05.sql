-- Add is_ok column to telegram_notifications
ALTER TABLE public.telegram_notifications ADD COLUMN is_ok boolean NOT NULL DEFAULT false;

-- Create telegram_labels table
CREATE TABLE public.telegram_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view labels in their clinic" ON public.telegram_labels
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert labels in their clinic" ON public.telegram_labels
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete labels in their clinic" ON public.telegram_labels
  FOR DELETE TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Create telegram_notification_labels junction table
CREATE TABLE public.telegram_notification_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.telegram_notifications(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.telegram_labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id, label_id)
);

ALTER TABLE public.telegram_notification_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notification labels" ON public.telegram_notification_labels
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.telegram_notifications tn
    WHERE tn.id = notification_id AND tn.clinic_id = get_user_clinic_id(auth.uid())
  ));

CREATE POLICY "Users can insert notification labels" ON public.telegram_notification_labels
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.telegram_notifications tn
    WHERE tn.id = notification_id AND tn.clinic_id = get_user_clinic_id(auth.uid())
  ));

CREATE POLICY "Users can delete notification labels" ON public.telegram_notification_labels
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.telegram_notifications tn
    WHERE tn.id = notification_id AND tn.clinic_id = get_user_clinic_id(auth.uid())
  ));