-- Allow admin and finance to update givings (for payment verification)
CREATE POLICY "Finance and admin can update givings"
ON public.givings
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'finance'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'finance'::app_role)
);