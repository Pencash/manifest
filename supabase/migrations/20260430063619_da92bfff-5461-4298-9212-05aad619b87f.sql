-- Tighten sensitive log table policies to authenticated staff only
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view login attempts" ON public.login_attempts;
CREATE POLICY "Admins can view login attempts"
ON public.login_attempts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "System can insert bounded login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "System can insert login attempts" ON public.login_attempts;

-- Controlled helper for pre-login rate-limit logging without exposing direct table writes
CREATE OR REPLACE FUNCTION public.log_login_attempt(p_email text, p_success boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) NOT BETWEEN 3 AND 320 THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;

  INSERT INTO public.login_attempts (email, success, ip_address)
  VALUES (lower(trim(p_email)), COALESCE(p_success, false), NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.log_login_attempt(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_login_attempt(text, boolean) TO anon, authenticated;

-- Remove realtime publication for expense payments if it is currently published
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'expense_payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.expense_payments;
  END IF;
END;
$$;

-- Harden receipt storage policies
DROP POLICY IF EXISTS "Users can delete their own receipts" ON storage.objects;
CREATE POLICY "Users can delete their own receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Finance/Admin can delete receipts" ON storage.objects;
CREATE POLICY "Finance/Admin can delete receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'finance'::app_role)
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload expense receipts" ON storage.objects;
CREATE POLICY "Users can upload expense receipts for own requests"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND EXISTS (
    SELECT 1
    FROM public.expense_requests req
    WHERE req.requester_id = auth.uid()
      AND storage.objects.name LIKE req.id::text || '/%'
  )
);

DROP POLICY IF EXISTS "Users can delete own expense receipt files" ON storage.objects;
CREATE POLICY "Users can delete own expense receipt files"
ON storage.objects
FOR DELETE
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
);