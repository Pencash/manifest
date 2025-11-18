-- Create user_roles table for secure role management
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'pastor' THEN 2
      WHEN 'finance' THEN 3
      WHEN 'member' THEN 4
    END
  LIMIT 1
$$;

-- RLS Policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies on profiles table
DROP POLICY IF EXISTS "Authenticated users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies on other tables to use has_role function
DROP POLICY IF EXISTS "Finance and admin can manage attendance" ON public.attendance;
CREATE POLICY "Finance and admin can manage attendance"
ON public.attendance
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'finance')
);

DROP POLICY IF EXISTS "Finance and admin can view all givings" ON public.givings;
CREATE POLICY "Finance and admin can view all givings"
ON public.givings
FOR SELECT
TO authenticated
USING (
  auth.uid() = profile_id OR
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'finance')
);

DROP POLICY IF EXISTS "Pastoral team can view prayer requests" ON public.prayer_requests;
CREATE POLICY "Pastoral team can view prayer requests"
ON public.prayer_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() = profile_id OR
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'pastor')
);

DROP POLICY IF EXISTS "Pastoral team can update prayer requests" ON public.prayer_requests;
CREATE POLICY "Pastoral team can update prayer requests"
ON public.prayer_requests
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'pastor')
);

DROP POLICY IF EXISTS "Finance and admin can view all receipts" ON public.receipts;
CREATE POLICY "Finance and admin can view all receipts"
ON public.receipts
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM givings WHERE givings.id = receipts.giving_id AND givings.profile_id = auth.uid()) OR
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'finance')
);

DROP POLICY IF EXISTS "Finance and admin can update receipts" ON public.receipts;
CREATE POLICY "Finance and admin can update receipts"
ON public.receipts
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'finance')
);

DROP POLICY IF EXISTS "Admin can manage services" ON public.services;
CREATE POLICY "Admin can manage services"
ON public.services
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'finance') OR
  public.has_role(auth.uid(), 'pastor')
);

DROP POLICY IF EXISTS "Pastoral team can view testimonies" ON public.testimonies;
CREATE POLICY "Pastoral team can view testimonies"
ON public.testimonies
FOR SELECT
TO authenticated
USING (
  auth.uid() = profile_id OR
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'pastor')
);

-- Remove role column from profiles table (keeping for backward compatibility)
-- We'll deprecate this in code but keep the column to avoid breaking existing queries
COMMENT ON COLUMN public.profiles.role IS 'DEPRECATED: Use user_roles table instead. Kept for backward compatibility.';