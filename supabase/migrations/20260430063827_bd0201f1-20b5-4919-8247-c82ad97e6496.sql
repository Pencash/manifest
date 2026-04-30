DROP POLICY IF EXISTS "All authenticated users can view active categories" ON public.expense_categories;
CREATE POLICY "All authenticated users can view active categories"
ON public.expense_categories
FOR SELECT
TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Admin manage targets" ON public.mobilization_targets;
CREATE POLICY "Admin manage targets"
ON public.mobilization_targets
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'pastor'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'pastor'::app_role)
);

DROP POLICY IF EXISTS "Users can update their own receipts" ON storage.objects;
CREATE POLICY "Users can update their own receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Finance/Admin can update receipt files" ON storage.objects;
CREATE POLICY "Finance/Admin can update receipt files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finance'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'receipts'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finance'::app_role)
  )
);

DROP POLICY IF EXISTS "Users can update own expense receipt files" ON storage.objects;
CREATE POLICY "Users can update own expense receipt files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND EXISTS (
    SELECT 1
    FROM public.expense_receipts er
    JOIN public.expense_requests req ON req.id = er.expense_request_id
    WHERE er.storage_path = storage.objects.name
      AND req.requester_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND EXISTS (
    SELECT 1
    FROM public.expense_receipts er
    JOIN public.expense_requests req ON req.id = er.expense_request_id
    WHERE er.storage_path = storage.objects.name
      AND req.requester_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Finance/Admin can update expense receipt files" ON storage.objects;
CREATE POLICY "Finance/Admin can update expense receipt files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finance'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finance'::app_role)
  )
);