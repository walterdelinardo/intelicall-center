-- Fix search_path for the timestamp update function
CREATE OR REPLACE FUNCTION public.update_chatwoot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;