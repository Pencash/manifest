-- Add service_type enum and update services table
CREATE TYPE service_type AS ENUM (
  'tuesday_fellowship',
  'thursday_livestream',
  'ltc',
  'sunday_service',
  'gic',
  'nop',
  'men_gather',
  'mgp',
  'other'
);

-- Add service_type to services table
ALTER TABLE public.services
ADD COLUMN service_type service_type DEFAULT 'other',
ADD COLUMN description text,
ADD COLUMN total_attendance integer DEFAULT 0,
ADD COLUMN is_published boolean DEFAULT true;

-- Create index for service_date for faster calendar queries
CREATE INDEX idx_services_service_date ON public.services(service_date);

-- Update RLS policies for services
DROP POLICY IF EXISTS "Authenticated users can view services" ON public.services;

CREATE POLICY "Authenticated users can view published services"
ON public.services
FOR SELECT
USING (is_published = true);

CREATE POLICY "Admin can manage services"
ON public.services
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'finance', 'pastor')
  )
);

-- Create a function to update total attendance when attendance records change
CREATE OR REPLACE FUNCTION update_service_attendance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total attendance for the service
  UPDATE public.services
  SET total_attendance = (
    SELECT COUNT(DISTINCT profile_id)
    FROM public.attendance
    WHERE service_id = COALESCE(NEW.service_id, OLD.service_id)
    AND status = 'present'
  )
  WHERE id = COALESCE(NEW.service_id, OLD.service_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for attendance updates
DROP TRIGGER IF EXISTS trigger_update_service_attendance ON public.attendance;
CREATE TRIGGER trigger_update_service_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION update_service_attendance();