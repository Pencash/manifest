-- 1. Extend givings table
ALTER TABLE public.givings
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'self_recorded',
  ADD COLUMN IF NOT EXISTS confirmed_not_basket boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid;

ALTER TABLE public.givings
  DROP CONSTRAINT IF EXISTS givings_source_check;
ALTER TABLE public.givings
  ADD CONSTRAINT givings_source_check
  CHECK (source IN ('self_recorded', 'basket_aggregate', 'basket_individual'));

CREATE INDEX IF NOT EXISTS idx_givings_status ON public.givings(status);
CREATE INDEX IF NOT EXISTS idx_givings_duplicate_of ON public.givings(duplicate_of);
CREATE INDEX IF NOT EXISTS idx_givings_profile_created ON public.givings(profile_id, created_at);

-- 2. Duplicate detection trigger
CREATE OR REPLACE FUNCTION public.detect_giving_duplicate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_id uuid;
  amount_floor numeric;
  amount_ceil numeric;
  ref_date timestamptz;
BEGIN
  -- Skip duplicate detection for basket aggregate entries and rejected rows
  IF NEW.source = 'basket_aggregate' OR NEW.status = 'rejected' THEN
    RETURN NEW;
  END IF;

  amount_floor := NEW.amount * 0.95;
  amount_ceil  := NEW.amount * 1.05;
  ref_date := COALESCE(NEW.created_at, now());

  SELECT id INTO existing_id
  FROM public.givings
  WHERE profile_id = NEW.profile_id
    AND giving_type_id = NEW.giving_type_id
    AND status <> 'rejected'
    AND source <> 'basket_aggregate'
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND amount BETWEEN amount_floor AND amount_ceil
    AND created_at BETWEEN ref_date - interval '2 days' AND ref_date + interval '2 days'
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    NEW.status := 'pending_duplicate_review';
    NEW.duplicate_of := existing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_giving_duplicate ON public.givings;
CREATE TRIGGER trg_detect_giving_duplicate
BEFORE INSERT ON public.givings
FOR EACH ROW
EXECUTE FUNCTION public.detect_giving_duplicate();

-- 3. Basket aggregates table
CREATE TABLE IF NOT EXISTS public.basket_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL,
  giving_type_id uuid NOT NULL,
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  currency text NOT NULL DEFAULT 'MWK',
  notes text,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'voided')),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  voided_by uuid,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, giving_type_id, status) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_basket_aggregates_service ON public.basket_aggregates(service_id);

ALTER TABLE public.basket_aggregates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin finance pastor view basket aggregates" ON public.basket_aggregates;
CREATE POLICY "Admin finance pastor view basket aggregates"
ON public.basket_aggregates
FOR SELECT
TO authenticated
USING (authz.has_role(auth.uid(), 'admin'::app_role)
    OR authz.has_role(auth.uid(), 'finance'::app_role)
    OR authz.has_role(auth.uid(), 'pastor'::app_role));

DROP POLICY IF EXISTS "Admin finance insert basket aggregates" ON public.basket_aggregates;
CREATE POLICY "Admin finance insert basket aggregates"
ON public.basket_aggregates
FOR INSERT
TO authenticated
WITH CHECK ((auth.uid() = recorded_by)
    AND (authz.has_role(auth.uid(), 'admin'::app_role)
      OR authz.has_role(auth.uid(), 'finance'::app_role)));

DROP POLICY IF EXISTS "Admin finance update basket aggregates" ON public.basket_aggregates;
CREATE POLICY "Admin finance update basket aggregates"
ON public.basket_aggregates
FOR UPDATE
TO authenticated
USING (authz.has_role(auth.uid(), 'admin'::app_role)
    OR authz.has_role(auth.uid(), 'finance'::app_role))
WITH CHECK (authz.has_role(auth.uid(), 'admin'::app_role)
    OR authz.has_role(auth.uid(), 'finance'::app_role));

DROP TRIGGER IF EXISTS trg_basket_aggregates_updated_at ON public.basket_aggregates;
CREATE TRIGGER trg_basket_aggregates_updated_at
BEFORE UPDATE ON public.basket_aggregates
FOR EACH ROW
EXECUTE FUNCTION public.update_expense_updated_at();
