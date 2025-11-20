-- Add new columns to services table for member-submitted pending events
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending_admin_approval', 'rejected'));

-- Set existing services as approved (they were created by admins)
UPDATE public.services 
SET approval_status = 'approved' 
WHERE approval_status IS NULL;

-- Create indices for faster queries
CREATE INDEX IF NOT EXISTS idx_services_approval_status ON public.services(approval_status);
CREATE INDEX IF NOT EXISTS idx_services_created_by ON public.services(created_by);

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Authenticated users can view published services" ON public.services;
DROP POLICY IF EXISTS "Admin can manage services" ON public.services;

-- Members can view approved published services OR their own pending services
CREATE POLICY "Users can view approved or own services"
ON public.services FOR SELECT
TO authenticated
USING (
  (is_published = true AND approval_status = 'approved')
  OR 
  (created_by = auth.uid())
  OR
  has_role(auth.uid(), 'admin'::app_role)
  OR
  has_role(auth.uid(), 'pastor'::app_role)
  OR
  has_role(auth.uid(), 'finance'::app_role)
);

-- Members can create pending services
CREATE POLICY "Members can create pending services"
ON public.services FOR INSERT
TO authenticated
WITH CHECK (
  approval_status = 'pending_admin_approval' AND
  created_by = auth.uid()
);

-- Admins can update all services
CREATE POLICY "Admins can update services"
ON public.services FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'pastor'::app_role)
);

-- Admins can delete services
CREATE POLICY "Admins can delete services"
ON public.services FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'pastor'::app_role)
);