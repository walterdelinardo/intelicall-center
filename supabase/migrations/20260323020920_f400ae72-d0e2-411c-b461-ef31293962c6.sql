ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS neighborhood TEXT;