
-- 1. Create expense_payments table
CREATE TABLE public.expense_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_request_id UUID NOT NULL REFERENCES public.expense_requests(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payment_method TEXT NOT NULL,
  payment_reference TEXT,
  payee_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'posted',
  recorded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;

-- 3. SELECT: admin, finance, pastor, or requester of the expense
CREATE POLICY "Users can view payments for accessible requests"
ON public.expense_payments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
  OR has_role(auth.uid(), 'pastor'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.expense_requests
    WHERE expense_requests.id = expense_payments.expense_request_id
      AND expense_requests.requester_id = auth.uid()
  )
);

-- 4. INSERT: admin and finance only
CREATE POLICY "Admin/Finance can record payments"
ON public.expense_payments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = recorded_by
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))
);

-- 5. UPDATE: admin and finance only
CREATE POLICY "Admin/Finance can update payments"
ON public.expense_payments FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)
);

-- 6. DELETE: admin only
CREATE POLICY "Admin can delete payments"
ON public.expense_payments FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. Allow finance to delete unapproved expense requests
CREATE POLICY "Finance can delete unapproved expense requests"
ON public.expense_requests FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'finance'::app_role)
  AND status NOT IN ('approved', 'partially_paid', 'paid')
);

-- 8. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_payments;
