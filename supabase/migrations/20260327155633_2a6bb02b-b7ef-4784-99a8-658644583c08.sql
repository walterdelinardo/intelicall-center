
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check legacy table
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
  OR EXISTS (
    -- Check dynamic role system: match role slug to the legacy enum name
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_definitions rd ON rd.id = ura.role_definition_id
    WHERE ura.user_id = _user_id
    AND (
      -- Super admin has all roles
      rd.is_super_admin = true
      -- Or slug matches the legacy role name (e.g. 'admin', 'podologo', 'recepcao', 'financeiro')
      OR rd.slug = _role::text
    )
  );
$$;
