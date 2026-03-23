
DROP POLICY "Admin and Pastor can view all profiles" ON public.profiles;

CREATE POLICY "Admin/Pastor/Finance can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'pastor'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
);
