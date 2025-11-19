-- Drop the existing admin-only policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create new policy that includes both admin and pastor roles
CREATE POLICY "Admin and Pastor can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'pastor'::app_role)
);