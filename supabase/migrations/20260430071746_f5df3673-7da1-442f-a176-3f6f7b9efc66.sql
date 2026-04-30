-- Scope member invitation policies to signed-in users only.
DROP POLICY IF EXISTS "Admin view all invitations" ON public.member_invitations;
CREATE POLICY "Admin view all invitations"
ON public.member_invitations
FOR SELECT
TO authenticated
USING (authz.has_role(auth.uid(), 'admin'::app_role) OR authz.has_role(auth.uid(), 'pastor'::app_role));

DROP POLICY IF EXISTS "Members manage own invitations" ON public.member_invitations;
CREATE POLICY "Members manage own invitations"
ON public.member_invitations
FOR ALL
TO authenticated
USING (auth.uid() = member_id)
WITH CHECK (auth.uid() = member_id);

-- Prevent uploads against closed expense requests at both metadata and storage layers.
DROP POLICY IF EXISTS "Users can upload receipts for own requests" ON public.expense_receipts;
CREATE POLICY "Users can upload receipts for own open requests"
ON public.expense_receipts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.expense_requests req
    WHERE req.id = expense_receipts.expense_request_id
      AND (
        req.requester_id = auth.uid()
        OR authz.has_role(auth.uid(), 'admin'::app_role)
        OR authz.has_role(auth.uid(), 'finance'::app_role)
      )
      AND req.status NOT IN ('paid', 'rejected', 'cancelled')
  )
);

DROP POLICY IF EXISTS "Users can upload expense receipts for own requests" ON storage.objects;
CREATE POLICY "Users can upload expense receipts for own open requests"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND EXISTS (
    SELECT 1
    FROM public.expense_requests req
    WHERE req.requester_id = auth.uid()
      AND req.status NOT IN ('paid', 'rejected', 'cancelled')
      AND storage.objects.name LIKE req.id::text || '/%'
  )
);

-- Confirm login attempts cannot be written directly by browser/database roles.
REVOKE ALL ON FUNCTION public.log_login_attempt(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.login_attempts FROM anon, authenticated;