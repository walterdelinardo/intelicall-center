
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  professional_id UUID NOT NULL,
  professional_name TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  procedure_name TEXT,
  prescription TEXT,
  orientations TEXT,
  observations TEXT,
  ai_safety_check TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage prescriptions in their clinic"
  ON public.prescriptions FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE TABLE public.assessment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  name TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.assessment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage assessment types in their clinic"
  ON public.assessment_types FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  assessment_type_id UUID NOT NULL REFERENCES public.assessment_types(id),
  professional_id UUID NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage assessments in their clinic"
  ON public.assessments FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));

CREATE TABLE public.record_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  tab TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.record_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit log in their clinic"
  ON public.record_audit_log FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert audit log in their clinic"
  ON public.record_audit_log FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
