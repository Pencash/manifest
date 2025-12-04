-- Function to backfill attendance snapshot fields for existing records
CREATE OR REPLACE FUNCTION public.backfill_attendance_snapshots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_updated integer := 0;
  profile_updated integer := 0;
  contact_updated integer := 0;
BEGIN
  -- Backfill event snapshots from services
  UPDATE attendance a SET
    snapshot_event_name = s.name,
    snapshot_event_date = s.service_date,
    snapshot_event_venue = s.location,
    snapshot_event_type = s.service_type::text
  FROM services s
  WHERE a.service_id = s.id
    AND a.snapshot_event_name IS NULL;
  
  GET DIAGNOSTICS event_updated = ROW_COUNT;
  
  -- Backfill person snapshots from profiles
  UPDATE attendance a SET
    snapshot_person_name = p.full_name,
    snapshot_person_email = p.email,
    snapshot_person_phone = p.phone
  FROM profiles p
  WHERE a.profile_id = p.id
    AND a.snapshot_person_name IS NULL;
  
  GET DIAGNOSTICS profile_updated = ROW_COUNT;
  
  -- Backfill person snapshots from contacts
  UPDATE attendance a SET
    snapshot_person_name = c.full_name,
    snapshot_person_email = c.email,
    snapshot_person_phone = c.phone
  FROM contacts c
  WHERE a.contact_id = c.id
    AND a.snapshot_person_name IS NULL;
  
  GET DIAGNOSTICS contact_updated = ROW_COUNT;
  
  RETURN event_updated + profile_updated + contact_updated;
END;
$$;

-- Function to auto-archive old services
CREATE OR REPLACE FUNCTION public.archive_old_services(days_old integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_count integer;
BEGIN
  UPDATE services SET
    is_archived = true,
    deleted_at = now()
  WHERE service_date < CURRENT_DATE - days_old
    AND (is_archived = false OR is_archived IS NULL)
    AND deleted_at IS NULL;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$;

-- Run backfill immediately for existing records
SELECT public.backfill_attendance_snapshots();