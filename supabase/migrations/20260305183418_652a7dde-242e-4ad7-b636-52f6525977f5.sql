
-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  birth_date DATE,
  cpf TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  notes TEXT,
  lead_source TEXT,
  total_visits INTEGER NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMPTZ,
  average_ticket NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Procedures catalog
CREATE TABLE public.procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  estimated_price NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'agendado',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- RLS policies for clients
CREATE POLICY "Users can view clients in their clinic"
ON public.clients FOR SELECT TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert clients in their clinic"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update clients in their clinic"
ON public.clients FOR UPDATE TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete clients in their clinic"
ON public.clients FOR DELETE TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

-- RLS policies for procedures
CREATE POLICY "Users can view procedures in their clinic"
ON public.procedures FOR SELECT TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert procedures in their clinic"
ON public.procedures FOR INSERT TO authenticated
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update procedures in their clinic"
ON public.procedures FOR UPDATE TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete procedures in their clinic"
ON public.procedures FOR DELETE TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

-- RLS policies for appointments
CREATE POLICY "Users can view appointments in their clinic"
ON public.appointments FOR SELECT TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can insert appointments in their clinic"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can update appointments in their clinic"
ON public.appointments FOR UPDATE TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

CREATE POLICY "Users can delete appointments in their clinic"
ON public.appointments FOR DELETE TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()));

-- Updated_at triggers
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_procedures_updated_at
  BEFORE UPDATE ON public.procedures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Index for performance
CREATE INDEX idx_clients_clinic ON public.clients(clinic_id);
CREATE INDEX idx_procedures_clinic ON public.procedures(clinic_id);
CREATE INDEX idx_appointments_clinic ON public.appointments(clinic_id);
CREATE INDEX idx_appointments_date ON public.appointments(date);
CREATE INDEX idx_appointments_client ON public.appointments(client_id);
CREATE INDEX idx_clients_name ON public.clients(clinic_id, name);
