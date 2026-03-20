CREATE TABLE public.record_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  title text NOT NULL DEFAULT 'Documento sem título',
  file_url text NOT NULL,
  file_type text DEFAULT 'image',
  ai_analysis text,
  ai_analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.record_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage record documents"
ON public.record_documents FOR ALL
TO authenticated
USING (clinic_id = get_user_clinic_id(auth.uid()))
WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));