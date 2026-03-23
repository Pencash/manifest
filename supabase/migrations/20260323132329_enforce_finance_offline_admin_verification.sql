-- Ensure every finance-recorded offline giving must remain pending until an admin verifies it.

UPDATE public.givings AS g
SET
  requires_admin_verification = true,
  status = 'pending',
  rejection_reason = null
WHERE g.entry_source = 'offline'
  AND COALESCE(g.requires_admin_verification, false) = false
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = g.recorded_by
      AND ur.role = 'finance'::app_role
  );

DROP POLICY IF EXISTS "Admin/Finance/Pastor can insert givings" ON public.givings;
CREATE POLICY "Admin/Finance/Pastor can insert givings"
ON public.givings
FOR INSERT
TO authenticated
WITH CHECK (
  (
    (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'pastor'::app_role)
    )
    AND (
      recorded_by IS NULL
      OR recorded_by = auth.uid()
    )
  )
  OR
  (
    has_role(auth.uid(), 'finance'::app_role)
    AND recorded_by = auth.uid()
    AND (
      entry_source <> 'offline'
      OR (
        COALESCE(requires_admin_verification, false) = true
        AND status = 'pending'
        AND rejection_reason IS NULL
      )
    )
  )
);

DROP POLICY IF EXISTS "Finance can update standard givings" ON public.givings;
CREATE POLICY "Finance can update standard givings"
ON public.givings
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'finance'::app_role)
  AND entry_source <> 'offline'
  AND COALESCE(requires_admin_verification, false) = false
)
WITH CHECK (
  has_role(auth.uid(), 'finance'::app_role)
  AND entry_source <> 'offline'
  AND COALESCE(requires_admin_verification, false) = false
);

DROP POLICY IF EXISTS "Finance can update own pending offline givings" ON public.givings;
CREATE POLICY "Finance can update own pending offline givings"
ON public.givings
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'finance'::app_role)
  AND recorded_by = auth.uid()
  AND entry_source = 'offline'
  AND COALESCE(requires_admin_verification, false) = true
  AND status = 'pending'
)
WITH CHECK (
  has_role(auth.uid(), 'finance'::app_role)
  AND recorded_by = auth.uid()
  AND entry_source = 'offline'
  AND COALESCE(requires_admin_verification, false) = true
  AND status = 'pending'
);
