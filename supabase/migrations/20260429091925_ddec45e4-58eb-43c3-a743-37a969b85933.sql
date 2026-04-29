CREATE TABLE public.restricted_fund_remittances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  remittance_month DATE NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MWK',
  remitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payment_method TEXT NOT NULL,
  payment_reference TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'posted',
  recorded_by UUID NOT NULL,
  voided_by UUID,
  voided_at TIMESTAMP WITH TIME ZONE,
  void_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT restricted_fund_remittances_amount_positive CHECK (amount > 0),
  CONSTRAINT restricted_fund_remittances_status_check CHECK (status IN ('posted', 'voided')),
  CONSTRAINT restricted_fund_remittances_payment_method_check CHECK (payment_method IN ('bank_transfer', 'cash_deposit', 'mobile_money', 'other')),
  CONSTRAINT restricted_fund_remittances_month_first_day CHECK (remittance_month = date_trunc('month', remittance_month)::date),
  CONSTRAINT restricted_fund_remittances_reference_required CHECK (
    payment_method NOT IN ('bank_transfer', 'mobile_money')
    OR NULLIF(TRIM(payment_reference), '') IS NOT NULL
  ),
  CONSTRAINT restricted_fund_remittances_void_fields_check CHECK (
    (status = 'posted' AND voided_by IS NULL AND voided_at IS NULL AND void_reason IS NULL)
    OR (status = 'voided' AND voided_by IS NOT NULL AND voided_at IS NOT NULL AND NULLIF(TRIM(void_reason), '') IS NOT NULL)
  )
);

ALTER TABLE public.restricted_fund_remittances ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_restricted_fund_remittances_month ON public.restricted_fund_remittances(remittance_month);
CREATE INDEX idx_restricted_fund_remittances_status ON public.restricted_fund_remittances(status);
CREATE INDEX idx_restricted_fund_remittances_recorded_by ON public.restricted_fund_remittances(recorded_by);

CREATE OR REPLACE FUNCTION public.update_restricted_fund_remittances_updated_at()
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

CREATE TRIGGER update_restricted_fund_remittances_updated_at
BEFORE UPDATE ON public.restricted_fund_remittances
FOR EACH ROW
EXECUTE FUNCTION public.update_restricted_fund_remittances_updated_at();

CREATE POLICY "Admin finance pastor can view restricted remittances"
ON public.restricted_fund_remittances
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'finance'::app_role)
  OR public.has_role(auth.uid(), 'pastor'::app_role)
);

CREATE POLICY "Admin finance can record restricted remittances"
ON public.restricted_fund_remittances
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = recorded_by
  AND status = 'posted'
  AND voided_by IS NULL
  AND voided_at IS NULL
  AND void_reason IS NULL
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "Admin can void restricted remittances"
ON public.restricted_fund_remittances
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));