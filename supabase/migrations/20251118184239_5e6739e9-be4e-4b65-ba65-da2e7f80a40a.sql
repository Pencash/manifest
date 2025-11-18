-- Drop the confusing restrictive deny policy
DROP POLICY IF EXISTS "Deny public access to profiles" ON public.profiles;

-- The existing policies already restrict to auth.uid() = id, which implicitly denies
-- unauthenticated access since auth.uid() returns null for anon users.
-- However, let's make it more explicit by recreating them with clear authentication checks.

-- Drop existing policies to recreate them more explicitly
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create clear permissive policies that explicitly check authentication
CREATE POLICY "Authenticated users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Authenticated users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Explicitly deny all access to anonymous/public users
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);