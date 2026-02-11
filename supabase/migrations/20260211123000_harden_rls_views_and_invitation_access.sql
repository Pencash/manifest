-- Security hardening for contacts/member_invitations + secure-invoker views

-- 1) Contacts table: explicit least-privilege RLS policies
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage contacts" ON public.contacts;
DROP POLICY IF EXISTS "Privileged roles can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Privileged roles can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Privileged roles can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;

CREATE POLICY "Privileged roles can view contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pastor')
  OR public.has_role(auth.uid(), 'finance')
);

CREATE POLICY "Privileged roles can insert contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pastor')
  OR public.has_role(auth.uid(), 'finance')
);

CREATE POLICY "Privileged roles can update contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pastor')
  OR public.has_role(auth.uid(), 'finance')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pastor')
  OR public.has_role(auth.uid(), 'finance')
);

CREATE POLICY "Admins can delete contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON TABLE public.contacts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contacts TO authenticated;

-- 2) Member invitations: ensure members only access their own invitation PII; privileged roles can audit all
ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage own invitations" ON public.member_invitations;
DROP POLICY IF EXISTS "Admin view all invitations" ON public.member_invitations;
DROP POLICY IF EXISTS "Privileged roles can view all invitations" ON public.member_invitations;

CREATE POLICY "Members manage own invitations"
ON public.member_invitations
FOR ALL
TO authenticated
USING (auth.uid() = member_id)
WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Privileged roles can view all invitations"
ON public.member_invitations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pastor')
  OR public.has_role(auth.uid(), 'finance')
);

REVOKE ALL ON TABLE public.member_invitations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.member_invitations TO authenticated;

-- 3) Views: avoid SECURITY DEFINER behavior by enforcing invoker security
DROP VIEW IF EXISTS public.attendance_with_context;
CREATE VIEW public.attendance_with_context
WITH (security_invoker = true)
AS
SELECT 
  a.id,
  a.service_id,
  a.profile_id,
  a.contact_id,
  a.status,
  a.count,
  a.created_at,
  a.attended_at,
  a.created_by,
  a.updated_by,
  a.updated_at,
  COALESCE(a.snapshot_event_name, s.name) as event_name,
  COALESCE(a.snapshot_event_date, s.service_date) as event_date,
  COALESCE(a.snapshot_event_venue, s.location) as event_venue,
  COALESCE(a.snapshot_event_type, s.service_type::text) as event_type,
  COALESCE(a.snapshot_person_name, p.full_name, c.full_name) as person_name,
  COALESCE(a.snapshot_person_email, p.email, c.email) as person_email,
  COALESCE(a.snapshot_person_phone, p.phone, c.phone) as person_phone
FROM public.attendance a
LEFT JOIN public.services s ON a.service_id = s.id
LEFT JOIN public.profiles p ON a.profile_id = p.id
LEFT JOIN public.contacts c ON a.contact_id = c.id;

DROP VIEW IF EXISTS public.anonymized_givings;
CREATE VIEW public.anonymized_givings
WITH (security_invoker = true)
AS
SELECT
  id,
  giving_type_id,
  service_id,
  amount,
  currency,
  payment_method,
  payment_reference,
  status,
  note,
  is_anonymous,
  created_at,
  CASE
    WHEN is_anonymous = true THEN NULL
    ELSE profile_id
  END as profile_id
FROM public.givings;

REVOKE ALL ON TABLE public.attendance_with_context FROM anon;
GRANT SELECT ON TABLE public.attendance_with_context TO authenticated;

REVOKE ALL ON TABLE public.anonymized_givings FROM anon;
GRANT SELECT ON TABLE public.anonymized_givings TO authenticated;
