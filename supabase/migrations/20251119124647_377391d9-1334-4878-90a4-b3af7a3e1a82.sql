-- Phase 1: Critical Security Fixes

-- 1. Update handle_new_user function to auto-assign 'member' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  
  -- Auto-assign default 'member' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');
  
  RETURN NEW;
END;
$$;

-- 2. Assign admin role to pnderitu2@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('441182de-72a5-43fe-a349-bd64c0f8e11d', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Backfill existing users without roles (assign 'member' role)
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'member'::app_role
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = au.id
)
AND au.id != '441182de-72a5-43fe-a349-bd64c0f8e11d';