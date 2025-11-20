-- Drop the existing foreign key constraint that points to auth.users
ALTER TABLE public.services 
DROP CONSTRAINT IF EXISTS services_created_by_fkey;

-- Add new foreign key pointing to profiles table
ALTER TABLE public.services 
ADD CONSTRAINT services_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;