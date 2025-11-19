-- Add is_archived column to services table for soft deletion
ALTER TABLE public.services 
ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;

-- Add index for better performance when filtering archived services
CREATE INDEX idx_services_archived ON public.services(is_archived);

-- Add comment for documentation
COMMENT ON COLUMN public.services.is_archived IS 'Soft delete flag for archiving past or cancelled services';