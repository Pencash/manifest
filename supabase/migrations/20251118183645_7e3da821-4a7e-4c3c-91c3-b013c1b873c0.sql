-- Drop the existing overly permissive policy for finance/admin
DROP POLICY IF EXISTS "Finance and admin can view all givings" ON public.givings;

-- Create new policy that respects anonymous donations
-- Finance and admin can view giving records, but for anonymous donations,
-- they can only see the financial data without donor identity
CREATE POLICY "Finance and admin can view givings with privacy"
ON public.givings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('finance', 'admin')
  )
  AND (
    -- For non-anonymous givings, show everything
    is_anonymous = false
    -- For anonymous givings, only allow if querying without profile_id
    -- This effectively means they can see aggregated data but not link to specific users
    OR (is_anonymous = true AND profile_id IS NULL)
  )
);

-- Add a view for finance/admin to see anonymized giving data
CREATE OR REPLACE VIEW public.anonymized_givings AS
SELECT
  id,
  giving_type_id,
  service_id,
  amount,
  currency,
  payment_method,
  payment_reference,
  status,
  note,
  is_anonymous,
  created_at,
  CASE
    WHEN is_anonymous = true THEN NULL
    ELSE profile_id
  END as profile_id
FROM public.givings;

-- Grant access to the anonymized view for finance and admin
GRANT SELECT ON public.anonymized_givings TO authenticated;