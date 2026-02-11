-- Allow members to edit only their own non-verified giving records
DROP POLICY IF EXISTS "Users can update own unverified givings" ON public.givings;

CREATE POLICY "Users can update own unverified givings"
ON public.givings
FOR UPDATE
TO authenticated
USING (
  auth.uid() = profile_id
  AND status <> 'verified'
)
WITH CHECK (
  auth.uid() = profile_id
  AND status <> 'verified'
);
