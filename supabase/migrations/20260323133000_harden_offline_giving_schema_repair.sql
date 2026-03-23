-- Defensive repair for environments where the offline-giving migration only partially applied.
-- Apply each schema change independently so one failing column does not block the others.

ALTER TABLE public.givings
  ADD COLUMN IF NOT EXISTS entry_source TEXT;

UPDATE public.givings
SET entry_source = 'member_app'
WHERE entry_source IS NULL;

ALTER TABLE public.givings
  ALTER COLUMN entry_source SET DEFAULT 'member_app',
  ALTER COLUMN entry_source SET NOT NULL;

ALTER TABLE public.givings
  DROP CONSTRAINT IF EXISTS givings_entry_source_check;

ALTER TABLE public.givings
  ADD CONSTRAINT givings_entry_source_check
  CHECK (entry_source IN ('member_app', 'offline'));

ALTER TABLE public.givings
  ADD COLUMN IF NOT EXISTS recorded_by UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'givings_recorded_by_fkey'
      AND conrelid = 'public.givings'::regclass
  ) THEN
    ALTER TABLE public.givings
      ADD CONSTRAINT givings_recorded_by_fkey
      FOREIGN KEY (recorded_by)
      REFERENCES auth.users(id);
  END IF;
END $$;

ALTER TABLE public.givings
  ADD COLUMN IF NOT EXISTS requires_admin_verification BOOLEAN;

UPDATE public.givings
SET requires_admin_verification = false
WHERE requires_admin_verification IS NULL;

ALTER TABLE public.givings
  ALTER COLUMN requires_admin_verification SET DEFAULT false,
  ALTER COLUMN requires_admin_verification SET NOT NULL;

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

DROP POLICY IF EXISTS "Admins can update all givings" ON public.givings;
CREATE POLICY "Admins can update all givings"
ON public.givings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Finance can update standard givings" ON public.givings;
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

DROP POLICY IF EXISTS "Admins can delete givings" ON public.givings;
CREATE POLICY "Admins can delete givings"
ON public.givings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Finance can delete own pending offline givings" ON public.givings;
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

NOTIFY pgrst, 'reload schema';
