
-- Storage bucket for record photos
INSERT INTO storage.buckets (id, name, public) VALUES ('record-photos', 'record-photos', true);

-- Medical records table
CREATE TABLE public.medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  chief_complaint TEXT,
  clinical_notes TEXT,
  diagnosis TEXT,
  treatment_performed TEXT,
  recommendations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foot assessment (specific to podiatry)
CREATE TABLE public.foot_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  foot TEXT NOT NULL DEFAULT 'left' CHECK (foot IN ('left', 'right')),
  nail_condition TEXT,
  skin_condition TEXT,
  deformities TEXT,
  sensitivity TEXT,
  circulation TEXT,
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products used during the session
CREATE TABLE public.record_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Photos attached to records
CREATE TABLE public.record_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  description TEXT,
  photo_type TEXT DEFAULT 'during',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_medical_records_client ON public.medical_records(client_id);
CREATE INDEX idx_medical_records_clinic ON public.medical_records(clinic_id);
CREATE INDEX idx_medical_records_date ON public.medical_records(date DESC);
CREATE INDEX idx_foot_assessments_record ON public.foot_assessments(record_id);
CREATE INDEX idx_record_products_record ON public.record_products(record_id);
CREATE INDEX idx_record_photos_record ON public.record_photos(record_id);

-- Updated_at trigger for medical_records
CREATE TRIGGER update_medical_records_updated_at
  BEFORE UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foot_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_photos ENABLE ROW LEVEL SECURITY;

-- medical_records policies
CREATE POLICY "Users can view records in their clinic" ON public.medical_records
  FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can insert records in their clinic" ON public.medical_records
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can update records in their clinic" ON public.medical_records
  FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can delete records in their clinic" ON public.medical_records
  FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()));

-- foot_assessments policies (through record)
CREATE POLICY "Users can manage foot assessments" ON public.foot_assessments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.medical_records mr WHERE mr.id = record_id AND mr.clinic_id = get_user_clinic_id(auth.uid()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.medical_records mr WHERE mr.id = record_id AND mr.clinic_id = get_user_clinic_id(auth.uid()))
  );

-- record_products policies
CREATE POLICY "Users can manage record products" ON public.record_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.medical_records mr WHERE mr.id = record_id AND mr.clinic_id = get_user_clinic_id(auth.uid()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.medical_records mr WHERE mr.id = record_id AND mr.clinic_id = get_user_clinic_id(auth.uid()))
  );

-- record_photos policies
CREATE POLICY "Users can manage record photos" ON public.record_photos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.medical_records mr WHERE mr.id = record_id AND mr.clinic_id = get_user_clinic_id(auth.uid()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.medical_records mr WHERE mr.id = record_id AND mr.clinic_id = get_user_clinic_id(auth.uid()))
  );

-- Storage policies for record-photos bucket
CREATE POLICY "Authenticated users can upload photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'record-photos');
CREATE POLICY "Authenticated users can view photos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'record-photos');
CREATE POLICY "Authenticated users can delete photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'record-photos');
