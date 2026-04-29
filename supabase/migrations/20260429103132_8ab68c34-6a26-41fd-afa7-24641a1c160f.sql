REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.is_rate_limited(text, inet) FROM authenticated;
REVOKE ALL ON FUNCTION public.log_security_event(text, text, uuid, jsonb) FROM authenticated;