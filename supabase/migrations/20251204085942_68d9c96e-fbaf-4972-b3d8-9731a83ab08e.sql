-- Phase 1: Resilient Attendance System
-- 1.1 Change Foreign Keys to SET NULL (protect attendance from cascades)
ALTER TABLE public.attendance 
  DROP CONSTRAINT IF EXISTS attendance_service_id_fkey;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_service_id_fkey 
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

ALTER TABLE public.attendance 
  DROP CONSTRAINT IF EXISTS attendance_contact_id_fkey;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_contact_id_fkey 
  FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.attendance 
  DROP CONSTRAINT IF EXISTS attendance_profile_id_fkey;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_profile_id_fkey 
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 1.2 Add Snapshot Columns (immutable event context at time of attendance)
ALTER TABLE public.attendance 
  ADD COLUMN IF NOT EXISTS snapshot_event_name TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_event_date DATE,
  ADD COLUMN IF NOT EXISTS snapshot_event_venue TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_event_type TEXT;

-- 1.3 Add Person Snapshot Columns (preserve identity at time of attendance)
ALTER TABLE public.attendance 
  ADD COLUMN IF NOT EXISTS snapshot_person_name TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_person_email TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_person_phone TEXT;

-- 1.4 Add Audit Fields
ALTER TABLE public.attendance 
  ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 1.5 Add soft-delete timestamp to services
ALTER TABLE public.services 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 1.6 Create trigger to auto-update updated_at on attendance
CREATE OR REPLACE FUNCTION public.update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_attendance_updated_at ON public.attendance;
CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_attendance_updated_at();

-- 1.7 Create reporting view for attendance with context
CREATE OR REPLACE VIEW public.attendance_with_context AS
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