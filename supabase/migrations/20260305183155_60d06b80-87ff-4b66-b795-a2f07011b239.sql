
-- Create a security definer function for onboarding that bypasses RLS
CREATE OR REPLACE FUNCTION public.setup_clinic(
  _clinic_name TEXT,
  _clinic_phone TEXT DEFAULT NULL,
  _clinic_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clinic_id UUID;
  _user_id UUID;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has a clinic
  IF EXISTS (SELECT 1 FROM profiles WHERE id = _user_id AND clinic_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to a clinic';
  END IF;

  -- Create clinic
  INSERT INTO clinics (name, phone, address)
  VALUES (_clinic_name, _clinic_phone, _clinic_address)
  RETURNING id INTO _clinic_id;

  -- Update profile
  UPDATE profiles SET clinic_id = _clinic_id WHERE id = _user_id;

  -- Assign admin role
  INSERT INTO user_roles (user_id, clinic_id, role)
  VALUES (_user_id, _clinic_id, 'admin');

  RETURN _clinic_id;
END;
$$;
