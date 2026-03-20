
-- 1. Tabela de materiais por procedimento
CREATE TABLE public.procedure_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.procedure_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage procedure materials in their clinic"
  ON public.procedure_materials FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

-- 2. Colunas de distância na lista de espera
ALTER TABLE public.waiting_list
  ADD COLUMN IF NOT EXISTS distance_km numeric,
  ADD COLUMN IF NOT EXISTS transit_time_min integer,
  ADD COLUMN IF NOT EXISTS driving_time_min integer;
