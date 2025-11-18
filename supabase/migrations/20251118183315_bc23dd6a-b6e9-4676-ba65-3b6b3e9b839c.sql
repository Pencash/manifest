-- Add explicit policy to deny public/anonymous access to profiles table
CREATE POLICY "Deny public access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);