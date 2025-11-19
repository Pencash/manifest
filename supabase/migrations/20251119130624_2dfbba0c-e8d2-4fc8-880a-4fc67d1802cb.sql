-- Step 1: Drop the storage policy that depends on profiles.role
DROP POLICY IF EXISTS "Finance and admin can view all receipts" ON storage.objects;

-- Step 2: Recreate the storage policy using has_role function
CREATE POLICY "Finance and admin can view all receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'finance'::app_role)
    OR EXISTS (
      SELECT 1 FROM givings 
      WHERE givings.profile_id = auth.uid() 
      AND storage.objects.name LIKE '%' || givings.id::text || '%'
    )
  )
);

-- Step 3: Remove duplicate role column from profiles table
ALTER TABLE public.profiles DROP COLUMN role;

-- Step 4: Clean up test users - cascades to profiles and user_roles
DELETE FROM auth.users WHERE email IN ('admin@test.com', 'finance@test.com');