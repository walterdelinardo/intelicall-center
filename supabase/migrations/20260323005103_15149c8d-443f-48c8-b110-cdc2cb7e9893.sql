
CREATE TABLE public.appointment_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'un',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage appointment materials in their clinic"
  ON public.appointment_materials FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
