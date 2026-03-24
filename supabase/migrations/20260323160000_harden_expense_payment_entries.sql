-- Harden expense payment entry rules after introducing the payment ledger.
-- This keeps new payment rows sufficient for reconciliation and prevents overpayment.

CREATE OR REPLACE FUNCTION public.validate_expense_payment_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_amount NUMERIC;
  request_status TEXT;
  existing_paid NUMERIC := 0;
  reference_required BOOLEAN;
BEGIN
  IF NEW.status <> 'posted' THEN
    RETURN NEW;
  END IF;

  SELECT amount, status
  INTO request_amount, request_status
  FROM public.expense_requests
  WHERE id = NEW.expense_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense request % does not exist.', NEW.expense_request_id;
  END IF;

  IF request_status NOT IN ('approved', 'partially_paid', 'paid') THEN
    RAISE EXCEPTION 'Payments can only be recorded for approved or settled expense requests. Current status: %.', request_status;
  END IF;

  IF COALESCE(BTRIM(NEW.payee_name), '') = '' THEN
    RAISE EXCEPTION 'Payee name is required when recording a posted expense payment.';
  END IF;

  reference_required := NEW.payment_method IN ('bank_transfer', 'mobile_money', 'card', 'cheque');
  IF reference_required AND LENGTH(COALESCE(BTRIM(NEW.payment_reference), '')) < 4 THEN
    RAISE EXCEPTION 'A payment reference of at least 4 characters is required for % payments.', NEW.payment_method;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO existing_paid
  FROM public.expense_payments
  WHERE expense_request_id = NEW.expense_request_id
    AND status = 'posted'
    AND id IS DISTINCT FROM NEW.id;

  IF existing_paid + NEW.amount > request_amount + 0.001 THEN
    RAISE EXCEPTION 'This payment would exceed the approved expense amount. Remaining balance: %.', request_amount - existing_paid;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_expense_payment_entry ON public.expense_payments;

CREATE TRIGGER validate_expense_payment_entry
  BEFORE INSERT OR UPDATE ON public.expense_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_expense_payment_entry();
