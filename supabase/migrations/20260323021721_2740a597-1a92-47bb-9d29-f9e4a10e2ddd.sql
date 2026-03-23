ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS address_complement TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address_complement TEXT;