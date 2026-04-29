-- Make the reporting view respect the querying user's permissions instead of the view owner
ALTER VIEW public.attendance_with_context SET (security_invoker = true);

-- Remove overly broad direct audit log inserts; trusted backend code can still write audit records
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Keep anonymous login attempt logging available, but make the policy non-trivial and constrained
DROP POLICY IF EXISTS "System can insert login attempts" ON public.login_attempts;
CREATE POLICY "System can insert bounded login attempts"
ON public.login_attempts
FOR INSERT
TO public
WITH CHECK (
  email IS NOT NULL
  AND length(trim(email)) BETWEEN 3 AND 320
  AND success IS NOT NULL
);

-- Revoke direct execution of SECURITY DEFINER routines that are only used as triggers or trusted maintenance helpers
REVOKE ALL ON FUNCTION public.archive_old_services(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backfill_attendance_snapshots() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_expense_request_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_role_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_attendance_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_budget_spent_amount() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_contacts_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_expense_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_member_invitations_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_service_attendance() FROM PUBLIC, anon, authenticated;

-- Anonymous users should not directly call role/rate-limit helpers
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_rate_limited(text, inet) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_security_event(text, text, uuid, jsonb) FROM PUBLIC, anon;

-- Preserve signed-in app behavior where these helpers are intentionally used by RLS/app code
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_rate_limited(text, inet) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, uuid, jsonb) TO authenticated;