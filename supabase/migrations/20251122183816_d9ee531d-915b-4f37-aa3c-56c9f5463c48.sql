-- Add RLS policy to allow admin, finance, and pastor roles to insert givings
CREATE POLICY "Admin/Finance/Pastor can insert givings"
ON public.givings
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
  OR has_role(auth.uid(), 'pastor'::app_role)
);