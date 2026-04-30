CREATE SCHEMA IF NOT EXISTS authz;

-- Move RLS helper functions out of the exposed public API schema.
ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA authz;
ALTER FUNCTION public.get_user_role(uuid) SET SCHEMA authz;

GRANT USAGE ON SCHEMA authz TO authenticated;
GRANT EXECUTE ON FUNCTION authz.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION authz.get_user_role(uuid) TO authenticated;

-- Ensure these helpers are not callable from anonymous sessions.
REVOKE ALL ON FUNCTION authz.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION authz.get_user_role(uuid) FROM PUBLIC, anon;