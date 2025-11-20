
-- Update RLS policy for expense_requests: Only admins can create
DROP POLICY IF EXISTS "Authenticated users can create expense requests" ON expense_requests;

CREATE POLICY "Only admins can create expense requests" 
ON expense_requests FOR INSERT 
TO authenticated 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'finance'::app_role) OR 
  has_role(auth.uid(), 'pastor'::app_role)
);

-- Update SELECT policy to allow all admins to view all requests
DROP POLICY IF EXISTS "Users can view own expense requests" ON expense_requests;

CREATE POLICY "Admins can view all expense requests" 
ON expense_requests FOR SELECT 
TO authenticated 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'finance'::app_role) OR 
  has_role(auth.uid(), 'pastor'::app_role)
);

-- Update UPDATE policy to allow admins to update requests
DROP POLICY IF EXISTS "Users can update own draft requests" ON expense_requests;

CREATE POLICY "Admins can update expense requests" 
ON expense_requests FOR UPDATE 
TO authenticated 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'finance'::app_role)
);
