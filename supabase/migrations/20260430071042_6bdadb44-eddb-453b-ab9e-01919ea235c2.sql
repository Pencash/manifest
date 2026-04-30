-- Restore execution access for RLS helper functions that policies depend on.
-- Without this, authenticated reads can fail because policies cannot evaluate roles.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

-- Keep sensitive login attempt logging unavailable for direct browser/database calls.
REVOKE ALL ON FUNCTION public.log_login_attempt(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_login_attempt(text, boolean) TO service_role;