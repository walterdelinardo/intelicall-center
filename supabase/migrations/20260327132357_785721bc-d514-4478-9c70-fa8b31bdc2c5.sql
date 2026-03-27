
-- 1. role_definitions table
CREATE TABLE public.role_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  is_system boolean NOT NULL DEFAULT false,
  is_super_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, slug)
);

ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view role definitions in their clinic"
  ON public.role_definitions FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Admins can manage role definitions in their clinic"
  ON public.role_definitions FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- 2. role_permissions table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_definition_id uuid NOT NULL REFERENCES public.role_definitions(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  can_read boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  UNIQUE(role_definition_id, module_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view role permissions via role definitions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.role_definitions rd
    WHERE rd.id = role_permissions.role_definition_id
    AND rd.clinic_id = get_user_clinic_id(auth.uid())
  ));

CREATE POLICY "Admins can manage role permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.role_definitions rd
    WHERE rd.id = role_permissions.role_definition_id
    AND rd.clinic_id = get_user_clinic_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.role_definitions rd
    WHERE rd.id = role_permissions.role_definition_id
    AND rd.clinic_id = get_user_clinic_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  ));

-- 3. user_role_assignments table
CREATE TABLE public.user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_definition_id uuid NOT NULL REFERENCES public.role_definitions(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_definition_id)
);

ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view role assignments in their clinic"
  ON public.user_role_assignments FOR SELECT TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()));

CREATE POLICY "Admins can manage role assignments in their clinic"
  ON public.user_role_assignments FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (clinic_id = get_user_clinic_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- 4. Security definer function to check dynamic permissions
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module_key text, _action text DEFAULT 'read')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_definitions rd ON rd.id = ura.role_definition_id
    LEFT JOIN public.role_permissions rp ON rp.role_definition_id = rd.id AND rp.module_key = _module_key
    WHERE ura.user_id = _user_id
    AND (
      rd.is_super_admin = true
      OR (
        CASE _action
          WHEN 'read' THEN rp.can_read
          WHEN 'edit' THEN rp.can_edit
          WHEN 'delete' THEN rp.can_delete
          ELSE false
        END
      )
    )
  );
$$;
