-- Add indexes for frequently queried columns to improve performance

-- Index on member_invitations.member_id (used in MemberMobilization page)
CREATE INDEX IF NOT EXISTS idx_member_invitations_member_id ON public.member_invitations(member_id);

-- Index on givings.profile_id (used in History page and queries)
CREATE INDEX IF NOT EXISTS idx_givings_profile_id ON public.givings(profile_id);

-- Index on givings.status (used for filtering pending givings)
CREATE INDEX IF NOT EXISTS idx_givings_status ON public.givings(status);

-- Composite index on services for common queries (published + approved + date)
CREATE INDEX IF NOT EXISTS idx_services_published_approved_date ON public.services(is_published, approval_status, service_date DESC);

-- Index on services.service_date for date-based queries
CREATE INDEX IF NOT EXISTS idx_services_date ON public.services(service_date DESC);

-- Index on attendance.service_id for attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_service_id ON public.attendance(service_id);

-- Index on attendance.profile_id for user attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_profile_id ON public.attendance(profile_id);