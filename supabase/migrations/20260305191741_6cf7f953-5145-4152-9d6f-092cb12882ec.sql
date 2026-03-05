
-- Stock Items table
CREATE TABLE public.stock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'geral',
  unit TEXT DEFAULT 'un',
  quantity NUMERIC NOT NULL DEFAULT 0,
  min_quantity NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  supplier TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock in their clinic" ON public.stock_items FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can insert stock in their clinic" ON public.stock_items FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can update stock in their clinic" ON public.stock_items FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can delete stock in their clinic" ON public.stock_items FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE INDEX idx_stock_items_clinic ON public.stock_items(clinic_id);

-- Leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  source TEXT DEFAULT 'manual',
  stage TEXT NOT NULL DEFAULT 'novo',
  notes TEXT,
  assigned_to UUID REFERENCES public.profiles(id),
  converted_client_id UUID REFERENCES public.clients(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view leads in their clinic" ON public.leads FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can insert leads in their clinic" ON public.leads FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can update leads in their clinic" ON public.leads FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can delete leads in their clinic" ON public.leads FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE INDEX idx_leads_clinic ON public.leads(clinic_id);
CREATE INDEX idx_leads_stage ON public.leads(stage);
