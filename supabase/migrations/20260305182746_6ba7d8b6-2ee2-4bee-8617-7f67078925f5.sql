
-- Fix: The trigger runs as SECURITY DEFINER but the insert policy is RESTRICTIVE (default is RESTRICTIVE when not specified)
-- Drop and recreate as PERMISSIVE policies

-- Fix profiles INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- Fix clinics INSERT policy - drop restrictive one and create permissive
DROP POLICY IF EXISTS "Authenticated users can create clinics" ON public.clinics;
CREATE POLICY "Authenticated users can create clinics"
ON public.clinics FOR INSERT TO authenticated
WITH CHECK (true);

-- Also need to allow the trigger (which runs as security definer) to work
-- The trigger function already has SECURITY DEFINER so it bypasses RLS
-- But let's ensure the profiles SELECT works even without clinic_id initially
DROP POLICY IF EXISTS "Users can view profiles in their clinic" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR clinic_id = public.get_user_clinic_id(auth.uid()));

-- Fix user_roles INSERT - users need to insert their own role during onboarding
DROP POLICY IF EXISTS "Admins can manage roles in their clinic" ON public.user_roles;
CREATE POLICY "Users can insert their own roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage roles in their clinic"
ON public.user_roles FOR ALL TO authenticated
USING (clinic_id = public.get_user_clinic_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
