-- Fix RLS policies for user_roles to ensure users can always see their own roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Allow users to view their own roles (this is critical for authentication)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow admins to view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Ensure profiles table is only accessible to authenticated users
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Ensure givings table is only accessible to authenticated users
DROP POLICY IF EXISTS "Users can view their own givings" ON public.givings;
DROP POLICY IF EXISTS "Finance and admin can view all givings" ON public.givings;

CREATE POLICY "Authenticated users can view their own givings"
ON public.givings
FOR SELECT
TO authenticated
USING (auth.uid() = profile_id);

CREATE POLICY "Finance and admin can view all givings"
ON public.givings
FOR SELECT
TO authenticated
USING (
  auth.uid() = profile_id 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'finance'::app_role)
);