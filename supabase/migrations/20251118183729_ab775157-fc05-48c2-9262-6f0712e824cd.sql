-- Drop the problematic view
DROP VIEW IF EXISTS public.anonymized_givings;

-- Drop the complex policy that doesn't work well with RLS
DROP POLICY IF EXISTS "Finance and admin can view givings with privacy" ON public.givings;

-- Restore a simple policy for finance/admin to view all givings
-- The anonymization will be handled at the application layer
CREATE POLICY "Finance and admin can view all givings"
ON public.givings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('finance', 'admin')
  )
);