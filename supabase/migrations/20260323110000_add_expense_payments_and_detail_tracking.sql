-- Add first-class payment ledger support for expense requests

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

CREATE TABLE public.expense_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_request_id UUID NOT NULL REFERENCES public.expense_requests(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'card', 'cheque', 'other')),
  payment_reference TEXT,
  payee_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'voided')),
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_payments_request_id ON public.expense_payments(expense_request_id);
CREATE INDEX idx_expense_payments_status ON public.expense_payments(status);
CREATE INDEX idx_expense_payments_payment_date ON public.expense_payments(payment_date DESC);

ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view expense payments for accessible requests"
  ON public.expense_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.expense_requests req
      WHERE req.id = expense_payments.expense_request_id
        AND (
          req.requester_id = auth.uid()
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'finance'::app_role)
          OR has_role(auth.uid(), 'pastor'::app_role)
        )
    )
  );

CREATE POLICY "Finance and admins can insert expense payments"
  ON public.expense_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = recorded_by
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'finance'::app_role)
    )
  );

CREATE POLICY "Finance and admins can update expense payments"
  ON public.expense_payments FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  );

CREATE POLICY "Admins can delete expense payments"
  ON public.expense_payments FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.update_expense_payment_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_expense_payments_updated_at
  BEFORE UPDATE ON public.expense_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_expense_payment_updated_at();

CREATE OR REPLACE FUNCTION public.refresh_expense_request_payment_state(target_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_record public.expense_requests%ROWTYPE;
  total_paid NUMERIC := 0;
  latest_payment_date TIMESTAMP WITH TIME ZONE;
  latest_recorded_by UUID;
  latest_payment_method TEXT;
  latest_payment_reference TEXT;
  next_status TEXT;
BEGIN
  SELECT *
  INTO request_record
  FROM public.expense_requests
  WHERE id = target_request_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO total_paid
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
    payment_reference = CASE WHEN total_paid > 0 THEN latest_payment_reference ELSE NULL END
  WHERE id = target_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_budget_spent_totals(target_category_id UUID, target_service_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_category_id IS NOT NULL THEN
    UPDATE public.budgets b
    SET spent_amount = COALESCE((
      SELECT SUM(ep.amount)
      FROM public.expense_payments ep
      JOIN public.expense_requests er ON er.id = ep.expense_request_id
      WHERE ep.status = 'posted'
        AND er.category_id = target_category_id
        AND er.service_id IS NULL
    ), 0)
    WHERE b.category_id = target_category_id
      AND b.service_id IS NULL;
  END IF;

  IF target_service_id IS NOT NULL THEN
    UPDATE public.budgets b
    SET spent_amount = COALESCE((
      SELECT SUM(ep.amount)
      FROM public.expense_payments ep
      JOIN public.expense_requests er ON er.id = ep.expense_request_id
      WHERE ep.status = 'posted'
        AND er.service_id = target_service_id
    ), 0)
    WHERE b.service_id = target_service_id
      AND b.category_id IS NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_expense_payment_side_effects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_request RECORD;
  new_request RECORD;
BEGIN
  IF TG_OP <> 'DELETE' THEN
    SELECT id, category_id, service_id
    INTO new_request
    FROM public.expense_requests
    WHERE id = NEW.expense_request_id;

    PERFORM public.refresh_expense_request_payment_state(NEW.expense_request_id);
    PERFORM public.refresh_budget_spent_totals(new_request.category_id, new_request.service_id);
  END IF;

  IF TG_OP <> 'INSERT' THEN
    SELECT id, category_id, service_id
    INTO old_request
    FROM public.expense_requests
    WHERE id = OLD.expense_request_id;

    IF TG_OP = 'DELETE' OR OLD.expense_request_id IS DISTINCT FROM NEW.expense_request_id THEN
      PERFORM public.refresh_expense_request_payment_state(OLD.expense_request_id);
      PERFORM public.refresh_budget_spent_totals(old_request.category_id, old_request.service_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS update_budget_on_expense_payment ON public.expense_requests;

CREATE TRIGGER sync_expense_payment_side_effects
  AFTER INSERT OR UPDATE OR DELETE ON public.expense_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_expense_payment_side_effects();

INSERT INTO public.expense_payments (
  expense_request_id,
  amount,
  payment_date,
  payment_method,
  payment_reference,
  notes,
  status,
  recorded_by,
  created_at,
  updated_at,
  payee_name
)
SELECT
  er.id,
  er.amount,
  COALESCE(er.paid_at, er.updated_at, er.created_at),
  COALESCE(er.payment_method, 'other'),
  er.payment_reference,
  'Backfilled from legacy expense payment fields.',
  'posted',
  COALESCE(er.paid_by, er.requester_id),
  COALESCE(er.paid_at, er.updated_at, er.created_at),
  COALESCE(er.updated_at, er.created_at),
  NULL
FROM public.expense_requests er
WHERE er.status = 'paid'
  AND (er.payment_method IS NOT NULL OR er.payment_reference IS NOT NULL OR er.paid_at IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM public.expense_payments ep
    WHERE ep.expense_request_id = er.id
  );

DO $$
DECLARE
  req RECORD;
BEGIN
  FOR req IN
    SELECT id, category_id, service_id
    FROM public.expense_requests
    WHERE status IN ('approved', 'partially_paid', 'paid')
  LOOP
    PERFORM public.refresh_expense_request_payment_state(req.id);
    PERFORM public.refresh_budget_spent_totals(req.category_id, req.service_id);
  END LOOP;
END;
$$;
