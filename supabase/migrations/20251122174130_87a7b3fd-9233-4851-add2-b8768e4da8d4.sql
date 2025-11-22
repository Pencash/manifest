-- Drop the restrictive admin-only policy
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- Create new policy allowing admin, finance, and pastor to insert profiles
CREATE POLICY "Admin/Finance/Pastor can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
  OR has_role(auth.uid(), 'pastor'::app_role)
);