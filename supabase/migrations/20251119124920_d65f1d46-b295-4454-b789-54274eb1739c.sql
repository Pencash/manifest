-- Phase 2: Security Enhancements

-- 1. Create audit_logs table for security event tracking
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- System can insert audit logs (via triggers)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Create index for better query performance
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 2. Create login_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address inet,
  success boolean DEFAULT false,
  attempted_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on login_attempts
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Admins can view login attempts
CREATE POLICY "Admins can view login attempts"
ON public.login_attempts
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- System can insert login attempts
CREATE POLICY "System can insert login attempts"
ON public.login_attempts
FOR INSERT
WITH CHECK (true);

-- Create index for rate limiting queries
CREATE INDEX idx_login_attempts_email_time ON public.login_attempts(email, attempted_at DESC);
CREATE INDEX idx_login_attempts_ip_time ON public.login_attempts(ip_address, attempted_at DESC);

-- Function to check if user is rate limited (5 failed attempts in 15 minutes)
CREATE OR REPLACE FUNCTION public.is_rate_limited(check_email text, check_ip inet)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failed_count integer;
BEGIN
  -- Count failed login attempts in last 15 minutes
  SELECT COUNT(*) INTO failed_count
  FROM public.login_attempts
  WHERE (email = check_email OR ip_address = check_ip)
    AND success = false
    AND attempted_at > now() - interval '15 minutes';
  
  -- Return true if 5 or more failed attempts
  RETURN failed_count >= 5;
END;
$$;

-- 3. Create trigger function to log role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      new_values
    ) VALUES (
      NEW.assigned_by,
      'role_assigned',
      'user_roles',
      NEW.id,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'role', NEW.role,
        'assigned_by', NEW.assigned_by
      )
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_values,
      new_values
    ) VALUES (
      NEW.assigned_by,
      'role_updated',
      'user_roles',
      NEW.id,
      jsonb_build_object(
        'user_id', OLD.user_id,
        'role', OLD.role
      ),
      jsonb_build_object(
        'user_id', NEW.user_id,
        'role', NEW.role,
        'assigned_by', NEW.assigned_by
      )
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_values
    ) VALUES (
      auth.uid(),
      'role_removed',
      'user_roles',
      OLD.id,
      jsonb_build_object(
        'user_id', OLD.user_id,
        'role', OLD.role
      )
    );
    RETURN OLD;
  END IF;
END;
$$;

-- Attach trigger to user_roles table
DROP TRIGGER IF EXISTS trigger_log_role_changes ON public.user_roles;
CREATE TRIGGER trigger_log_role_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_role_change();

-- 4. Function to log general security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action text,
  p_table_name text DEFAULT NULL,
  p_record_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    new_values
  ) VALUES (
    auth.uid(),
    p_action,
    p_table_name,
    p_record_id,
    p_details
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;