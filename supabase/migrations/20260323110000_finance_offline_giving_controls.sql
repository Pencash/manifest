-- Track offline giving origin and tighten finance/admin permissions for verification workflows
ALTER TABLE public.givings
  ADD COLUMN IF NOT EXISTS entry_source TEXT NOT NULL DEFAULT 'member_app',
  ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS requires_admin_verification BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.givings
  DROP CONSTRAINT IF EXISTS givings_entry_source_check;

ALTER TABLE public.givings
  ADD CONSTRAINT givings_entry_source_check
  CHECK (entry_source IN ('member_app', 'offline'));

CREATE INDEX IF NOT EXISTS idx_givings_recorded_by ON public.givings(recorded_by);
CREATE INDEX IF NOT EXISTS idx_givings_requires_admin_verification ON public.givings(requires_admin_verification);

DROP POLICY IF EXISTS "Admin/Finance/Pastor can insert givings" ON public.givings;
CREATE POLICY "Admin/Finance/Pastor can insert givings"
ON public.givings
FOR INSERT
TO authenticated
WITH CHECK (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'pastor'::app_role)
  )
  AND (
    recorded_by IS NULL
    OR recorded_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Finance and admin can update givings" ON public.givings;

CREATE POLICY "Admins can update all givings"
ON public.givings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance can update standard givings"
ON public.givings
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'finance'::app_role)
  AND COALESCE(requires_admin_verification, false) = false
)
WITH CHECK (
  has_role(auth.uid(), 'finance'::app_role)
  AND COALESCE(requires_admin_verification, false) = false
);

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

CREATE POLICY "Admins can delete givings"
ON public.givings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Finance can delete own pending offline givings"
ON public.givings
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'finance'::app_role)
  AND recorded_by = auth.uid()
  AND entry_source = 'offline'
  AND COALESCE(requires_admin_verification, false) = true
  AND status = 'pending'
);
