-- ============================================================================
-- Expense lifecycle integrity: payment ledger sync, validation, archive, RPCs
-- ============================================================================

-- Ensure expense_requests.status allows the full lifecycle
ALTER TABLE public.expense_requests
  DROP CONSTRAINT IF EXISTS expense_requests_status_check;

ALTER TABLE public.expense_requests
  ADD CONSTRAINT expense_requests_status_check
  CHECK (
    status IN (
      'draft',
      'pending',
      'approved',
      'partially_paid',
      'rejected',
      'changes_requested',
      'paid',
      'cancelled'
    )
  );

-- Ensure expense_payments.status allows posted/voided
ALTER TABLE public.expense_payments
  DROP CONSTRAINT IF EXISTS expense_payments_status_check;

ALTER TABLE public.expense_payments
  ADD CONSTRAINT expense_payments_status_check
  CHECK (status IN ('posted', 'voided'));

-- Archive fields on expense_requests
ALTER TABLE public.expense_requests
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS archive_reason text;

CREATE INDEX IF NOT EXISTS idx_expense_requests_is_archived
  ON public.expense_requests(is_archived);
CREATE INDEX IF NOT EXISTS idx_expense_requests_status
  ON public.expense_requests(status);

-- ============================================================================
-- Sync function: recompute expense_requests.status from posted ledger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refresh_expense_request_payment_state(target_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record public.expense_requests%ROWTYPE;
  total_paid numeric := 0;
  latest_payment_date timestamptz;
  latest_recorded_by uuid;
  latest_payment_method text;
  latest_payment_reference text;
  next_status text;
BEGIN
  SELECT * INTO request_record
  FROM public.expense_requests
  WHERE id = target_request_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.expense_payments
  WHERE expense_request_id = target_request_id
    AND status = 'posted';

  SELECT payment_date, recorded_by, payment_method, payment_reference
  INTO latest_payment_date, latest_recorded_by, latest_payment_method, latest_payment_reference
  FROM public.expense_payments
  WHERE expense_request_id = target_request_id
    AND status = 'posted'
  ORDER BY payment_date DESC, created_at DESC
  LIMIT 1;

  next_status := request_record.status;

  -- Only adjust status when the request is in payable/paid lifecycle
  IF request_record.status IN ('approved', 'partially_paid', 'paid') THEN
    IF total_paid <= 0 THEN
      next_status := 'approved';
    ELSIF total_paid < request_record.amount THEN
      next_status := 'partially_paid';
    ELSE
      next_status := 'paid';
    END IF;
  END IF;

  UPDATE public.expense_requests
  SET
    status = next_status,
    paid_at = CASE WHEN total_paid > 0 THEN latest_payment_date ELSE NULL END,
    paid_by = CASE WHEN total_paid > 0 THEN latest_recorded_by ELSE NULL END,
    payment_method = CASE WHEN total_paid > 0 THEN latest_payment_method ELSE NULL END,
    payment_reference = CASE WHEN total_paid > 0 THEN latest_payment_reference ELSE NULL END,
    updated_at = now()
  WHERE id = target_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_expense_request_payment_state(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- Trigger that fires on every payment change to keep the parent request in sync
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_expense_payment_side_effects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'DELETE' THEN
    PERFORM public.refresh_expense_request_payment_state(NEW.expense_request_id);
  END IF;

  IF TG_OP <> 'INSERT' THEN
    IF TG_OP = 'DELETE' OR OLD.expense_request_id IS DISTINCT FROM NEW.expense_request_id THEN
      PERFORM public.refresh_expense_request_payment_state(OLD.expense_request_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_expense_payment_side_effects ON public.expense_payments;
CREATE TRIGGER sync_expense_payment_side_effects
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_expense_payment_side_effects();

-- ============================================================================
-- Payment validation trigger: prevent invalid posted payments
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_expense_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.expense_requests%ROWTYPE;
  posted_total numeric := 0;
BEGIN
  SELECT * INTO req
  FROM public.expense_requests
  WHERE id = NEW.expense_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense request % not found', NEW.expense_request_id;
  END IF;

  -- Block payments on non-payable statuses for new posted rows or when posting an existing voided row
  IF NEW.status = 'posted' THEN
    IF req.status NOT IN ('approved', 'partially_paid') THEN
      -- Allow refresh trigger to bring 'paid' back to partially_paid via void; only block fresh posted payments
      IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') <> 'posted') THEN
        RAISE EXCEPTION 'Cannot record a payment when expense request status is %', req.status
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO posted_total
    FROM public.expense_payments
    WHERE expense_request_id = NEW.expense_request_id
      AND status = 'posted'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF posted_total + NEW.amount > req.amount + 0.001 THEN
      RAISE EXCEPTION 'Payment of % would exceed the requested amount of % (already posted: %)',
        NEW.amount, req.amount, posted_total
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_expense_payment ON public.expense_payments;
CREATE TRIGGER validate_expense_payment
  BEFORE INSERT OR UPDATE ON public.expense_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_expense_payment();

-- ============================================================================
-- RPC: record_expense_payment (atomic insert + validate + sync)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_expense_payment(
  p_expense_request_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_date timestamptz DEFAULT now(),
  p_payment_reference text DEFAULT NULL,
  p_payee_name text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.expense_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  inserted public.expense_payments;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (authz.has_role(caller, 'admin'::app_role) OR authz.has_role(caller, 'finance'::app_role)) THEN
    RAISE EXCEPTION 'Only finance or admin can record payments' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than 0';
  END IF;

  INSERT INTO public.expense_payments (
    expense_request_id, amount, payment_date, payment_method,
    payment_reference, payee_name, notes, status, recorded_by
  ) VALUES (
    p_expense_request_id, p_amount, COALESCE(p_payment_date, now()), p_payment_method,
    NULLIF(trim(p_payment_reference), ''), NULLIF(trim(p_payee_name), ''),
    NULLIF(trim(p_notes), ''), 'posted', caller
  )
  RETURNING * INTO inserted;

  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.record_expense_payment(uuid, numeric, text, timestamptz, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_expense_payment(uuid, numeric, text, timestamptz, text, text, text) TO authenticated;

-- ============================================================================
-- RPC: void_expense_payment (atomic update + sync)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.void_expense_payment(
  p_payment_id uuid,
  p_void_reason text DEFAULT NULL
)
RETURNS public.expense_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  existing public.expense_payments;
  next_notes text;
  updated public.expense_payments;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (authz.has_role(caller, 'admin'::app_role) OR authz.has_role(caller, 'finance'::app_role)) THEN
    RAISE EXCEPTION 'Only finance or admin can void payments' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO existing FROM public.expense_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF existing.status = 'voided' THEN
    RETURN existing;
  END IF;

  next_notes := COALESCE(existing.notes, '');
  IF next_notes <> '' THEN next_notes := next_notes || E'\n\n'; END IF;
  next_notes := next_notes || 'VOID REASON: ' || COALESCE(NULLIF(trim(p_void_reason), ''), 'Not provided');

  UPDATE public.expense_payments
  SET status = 'voided', notes = next_notes
  WHERE id = p_payment_id
  RETURNING * INTO updated;

  RETURN updated;
END;
$$;

REVOKE ALL ON FUNCTION public.void_expense_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_expense_payment(uuid, text) TO authenticated;

-- ============================================================================
-- RPC: archive / restore expense requests
-- ============================================================================
CREATE OR REPLACE FUNCTION public.archive_expense_request(
  p_expense_request_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.expense_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  req public.expense_requests;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (authz.has_role(caller, 'admin'::app_role) OR authz.has_role(caller, 'finance'::app_role)) THEN
    RAISE EXCEPTION 'Only finance or admin can archive expense requests' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO req FROM public.expense_requests WHERE id = p_expense_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense request not found';
  END IF;

  IF req.status NOT IN ('paid', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Only paid, rejected, or cancelled requests can be archived (current: %)', req.status;
  END IF;

  UPDATE public.expense_requests
  SET is_archived = true,
      archived_at = now(),
      archived_by = caller,
      archive_reason = NULLIF(trim(p_reason), ''),
      updated_at = now()
  WHERE id = p_expense_request_id
  RETURNING * INTO req;

  RETURN req;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_expense_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_expense_request(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_expense_request(p_expense_request_id uuid)
RETURNS public.expense_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  req public.expense_requests;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (authz.has_role(caller, 'admin'::app_role) OR authz.has_role(caller, 'finance'::app_role)) THEN
    RAISE EXCEPTION 'Only finance or admin can restore expense requests' USING ERRCODE = '42501';
  END IF;

  UPDATE public.expense_requests
  SET is_archived = false,
      archived_at = NULL,
      archived_by = NULL,
      archive_reason = NULL,
      updated_at = now()
  WHERE id = p_expense_request_id
  RETURNING * INTO req;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense request not found';
  END IF;

  RETURN req;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_expense_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_expense_request(uuid) TO authenticated;

-- ============================================================================
-- Backfill: recompute every existing request's payment state from the ledger
-- ============================================================================
DO $$
DECLARE
  req RECORD;
BEGIN
  FOR req IN SELECT id FROM public.expense_requests
  LOOP
    PERFORM public.refresh_expense_request_payment_state(req.id);
  END LOOP;
END;
$$;