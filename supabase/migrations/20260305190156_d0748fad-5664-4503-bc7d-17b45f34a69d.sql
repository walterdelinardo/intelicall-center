
-- Financial transactions table
CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'receita' CHECK (type IN ('receita', 'despesa')),
  category TEXT NOT NULL DEFAULT 'atendimento',
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'dinheiro',
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commissions table
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  percentage NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_financial_transactions_clinic ON public.financial_transactions(clinic_id);
CREATE INDEX idx_financial_transactions_date ON public.financial_transactions(date DESC);
CREATE INDEX idx_financial_transactions_type ON public.financial_transactions(type);
CREATE INDEX idx_commissions_clinic ON public.commissions(clinic_id);
CREATE INDEX idx_commissions_professional ON public.commissions(professional_id);
CREATE INDEX idx_commissions_date ON public.commissions(date DESC);

-- Updated_at trigger
CREATE TRIGGER update_financial_transactions_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS for financial_transactions
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions in their clinic" ON public.financial_transactions
  FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can insert transactions in their clinic" ON public.financial_transactions
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can update transactions in their clinic" ON public.financial_transactions
  FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can delete transactions in their clinic" ON public.financial_transactions
  FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()));

-- RLS for commissions
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view commissions in their clinic" ON public.commissions
  FOR SELECT USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can insert commissions in their clinic" ON public.commissions
  FOR INSERT WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can update commissions in their clinic" ON public.commissions
  FOR UPDATE USING (clinic_id = get_user_clinic_id(auth.uid()));
CREATE POLICY "Users can delete commissions in their clinic" ON public.commissions
  FOR DELETE USING (clinic_id = get_user_clinic_id(auth.uid()));

-- Function to auto-generate financial transaction when appointment status changes to 'compareceu'
CREATE OR REPLACE FUNCTION public.auto_generate_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_name TEXT;
  _procedure_name TEXT;
  _price NUMERIC;
BEGIN
  -- Only trigger when status changes to 'compareceu'
  IF NEW.status = 'compareceu' AND (OLD.status IS NULL OR OLD.status != 'compareceu') THEN
    -- Get client name
    SELECT name INTO _client_name FROM public.clients WHERE id = NEW.client_id;
    
    -- Get procedure info
    IF NEW.procedure_id IS NOT NULL THEN
      SELECT name, price INTO _procedure_name, _price FROM public.procedures WHERE id = NEW.procedure_id;
    END IF;

    -- Use estimated_price if available, otherwise procedure price
    _price := COALESCE(NEW.estimated_price, _price, 0);

    -- Check if transaction already exists for this appointment
    IF NOT EXISTS (SELECT 1 FROM public.financial_transactions WHERE appointment_id = NEW.id) THEN
      INSERT INTO public.financial_transactions (
        clinic_id, appointment_id, client_id, professional_id,
        type, category, description, amount, date, status
      ) VALUES (
        NEW.clinic_id, NEW.id, NEW.client_id, NEW.professional_id,
        'receita', 'atendimento',
        COALESCE(_procedure_name, 'Atendimento') || ' — ' || COALESCE(_client_name, 'Cliente'),
        _price, NEW.date, 'pendente'
      );
    END IF;

    -- Update client visit stats
    UPDATE public.clients SET
      total_visits = total_visits + 1,
      last_visit_at = NOW()
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to appointments table
CREATE TRIGGER trg_auto_generate_transaction
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.auto_generate_transaction();
