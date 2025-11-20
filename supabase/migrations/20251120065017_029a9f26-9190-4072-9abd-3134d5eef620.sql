-- Create expense categories table
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create budgets table
CREATE TABLE public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  allocated_amount NUMERIC NOT NULL DEFAULT 0,
  spent_amount NUMERIC NOT NULL DEFAULT 0,
  remaining_amount NUMERIC GENERATED ALWAYS AS (allocated_amount - spent_amount) STORED,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active', 'closed')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT budget_type_check CHECK (
    (category_id IS NOT NULL AND service_id IS NULL) OR 
    (category_id IS NULL AND service_id IS NOT NULL)
  )
);

-- Create expense requests table
CREATE TABLE public.expense_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_number TEXT UNIQUE,
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  category_id UUID NOT NULL REFERENCES public.expense_categories(id),
  service_id UUID REFERENCES public.services(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MWK',
  description TEXT NOT NULL,
  justification TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'changes_requested', 'paid', 'cancelled')),
  payment_method TEXT,
  payment_reference TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expense receipts table
CREATE TABLE public.expense_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_request_id UUID NOT NULL REFERENCES public.expense_requests(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expense approvals table (audit trail)
CREATE TABLE public.expense_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_request_id UUID NOT NULL REFERENCES public.expense_requests(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'changes_requested')),
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expense_categories
CREATE POLICY "All authenticated users can view active categories"
  ON public.expense_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage expense categories"
  ON public.expense_categories FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for budgets
CREATE POLICY "Admin/Finance/Pastor can view budgets"
  ON public.budgets FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finance'::app_role) OR 
    has_role(auth.uid(), 'pastor'::app_role)
  );

CREATE POLICY "Admin/Finance/Pastor can manage budgets"
  ON public.budgets FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finance'::app_role) OR 
    has_role(auth.uid(), 'pastor'::app_role)
  );

CREATE POLICY "Admin/Finance/Pastor can update budgets"
  ON public.budgets FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finance'::app_role) OR 
    has_role(auth.uid(), 'pastor'::app_role)
  );

CREATE POLICY "Admins can delete budgets"
  ON public.budgets FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for expense_requests
CREATE POLICY "Users can view own expense requests"
  ON public.expense_requests FOR SELECT
  USING (
    auth.uid() = requester_id OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finance'::app_role) OR 
    has_role(auth.uid(), 'pastor'::app_role)
  );

CREATE POLICY "Authenticated users can create expense requests"
  ON public.expense_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update own draft requests"
  ON public.expense_requests FOR UPDATE
  USING (
    (auth.uid() = requester_id AND status = 'draft') OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finance'::app_role)
  );

CREATE POLICY "Admin can delete expense requests"
  ON public.expense_requests FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for expense_receipts
CREATE POLICY "Users can view receipts for accessible requests"
  ON public.expense_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.expense_requests
      WHERE id = expense_receipts.expense_request_id
      AND (
        requester_id = auth.uid() OR 
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'finance'::app_role) OR 
        has_role(auth.uid(), 'pastor'::app_role)
      )
    )
  );

CREATE POLICY "Users can upload receipts for own requests"
  ON public.expense_receipts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expense_requests
      WHERE id = expense_receipts.expense_request_id
      AND (
        requester_id = auth.uid() OR 
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'finance'::app_role)
      )
    )
  );

CREATE POLICY "Finance/Admin can delete receipts"
  ON public.expense_receipts FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'finance'::app_role)
  );

-- RLS Policies for expense_approvals
CREATE POLICY "Users can view approvals for accessible requests"
  ON public.expense_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.expense_requests
      WHERE id = expense_approvals.expense_request_id
      AND (
        requester_id = auth.uid() OR 
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'finance'::app_role) OR 
        has_role(auth.uid(), 'pastor'::app_role)
      )
    )
  );

CREATE POLICY "Approvers can insert approvals"
  ON public.expense_approvals FOR INSERT
  WITH CHECK (
    auth.uid() = approver_id AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'finance'::app_role) OR 
      has_role(auth.uid(), 'pastor'::app_role)
    )
  );

-- Function to generate expense request number
CREATE OR REPLACE FUNCTION public.generate_expense_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
BEGIN
  IF NEW.request_number IS NULL AND NEW.status != 'draft' THEN
    year_part := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COALESCE(MAX(SUBSTRING(request_number FROM 'EXP-\d{4}-(\d+)')::INTEGER), 0) + 1
    INTO sequence_num
    FROM public.expense_requests
    WHERE request_number LIKE 'EXP-' || year_part || '-%';
    
    NEW.request_number := 'EXP-' || year_part || '-' || LPAD(sequence_num::TEXT, 3, '0');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_expense_request_number
  BEFORE INSERT OR UPDATE ON public.expense_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_expense_request_number();

-- Function to update budget spent amount
CREATE OR REPLACE FUNCTION public.update_budget_spent_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    -- Add to budget spent amount
    UPDATE public.budgets
    SET spent_amount = spent_amount + NEW.amount
    WHERE (category_id = NEW.category_id AND service_id IS NULL)
       OR (service_id = NEW.service_id AND category_id IS NULL);
  ELSIF OLD.status = 'paid' AND NEW.status != 'paid' THEN
    -- Subtract from budget spent amount
    UPDATE public.budgets
    SET spent_amount = spent_amount - OLD.amount
    WHERE (category_id = OLD.category_id AND service_id IS NULL)
       OR (service_id = OLD.service_id AND category_id IS NULL);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_budget_on_expense_payment
  AFTER UPDATE ON public.expense_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_budget_spent_amount();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_expense_updated_at()
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

CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_expense_updated_at();

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_expense_updated_at();

CREATE TRIGGER update_expense_requests_updated_at
  BEFORE UPDATE ON public.expense_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_expense_updated_at();

-- Create storage bucket for expense receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for expense-receipts bucket
CREATE POLICY "Users can view receipts for accessible requests"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'expense-receipts' AND
    EXISTS (
      SELECT 1 FROM public.expense_receipts er
      JOIN public.expense_requests req ON er.expense_request_id = req.id
      WHERE er.storage_path = storage.objects.name
      AND (
        req.requester_id = auth.uid() OR
        has_role(auth.uid(), 'admin'::app_role) OR
        has_role(auth.uid(), 'finance'::app_role) OR
        has_role(auth.uid(), 'pastor'::app_role)
      )
    )
  );

CREATE POLICY "Authenticated users can upload expense receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'expense-receipts' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Finance/Admin can delete expense receipts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'expense-receipts' AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  );