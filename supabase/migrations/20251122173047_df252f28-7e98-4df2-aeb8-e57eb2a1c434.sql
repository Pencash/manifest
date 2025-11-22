-- Allow admins to insert profiles for offline giving records
CREATE POLICY "Admins can insert profiles" ON public.profiles
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));