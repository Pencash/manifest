-- Add verification fields to receipts table
ALTER TABLE public.receipts
ADD COLUMN verification_status text NOT NULL DEFAULT 'pending',
ADD COLUMN verification_notes text,
ADD COLUMN verified_by uuid REFERENCES auth.users(id),
ADD COLUMN verified_at timestamp with time zone;

-- Add constraint for verification status
ALTER TABLE public.receipts
ADD CONSTRAINT receipts_verification_status_check 
CHECK (verification_status IN ('pending', 'approved', 'rejected'));

-- Create policy for finance/admin to update receipts
CREATE POLICY "Finance and admin can update receipts"
ON public.receipts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('finance', 'admin')
  )
);