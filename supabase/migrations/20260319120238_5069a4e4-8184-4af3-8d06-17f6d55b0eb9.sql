
-- Waiting list table
CREATE TABLE public.waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_phone text,
  procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL,
  professional_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  desired_date date,
  time_range_start time,
  time_range_end time,
  flexibility text DEFAULT 'mesmo_dia',
  priority text NOT NULL DEFAULT 'normal',
  origin text DEFAULT 'manual',
  status text NOT NULL DEFAULT 'aguardando',
  notes text,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view waiting list in their clinic" ON public.waiting_list
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert waiting list in their clinic" ON public.waiting_list
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update waiting list in their clinic" ON public.waiting_list
  FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete waiting list in their clinic" ON public.waiting_list
  FOR DELETE TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Waiting list history table
CREATE TABLE public.waiting_list_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waiting_list_id uuid NOT NULL REFERENCES public.waiting_list(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waiting_list_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view waiting list history in their clinic" ON public.waiting_list_history
  FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert waiting list history in their clinic" ON public.waiting_list_history
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_waiting_list_updated_at
  BEFORE UPDATE ON public.waiting_list
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
