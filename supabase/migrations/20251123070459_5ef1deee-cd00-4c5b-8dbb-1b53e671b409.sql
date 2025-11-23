-- Add constraint to ensure only valid contact types are allowed
ALTER TABLE public.contacts 
ADD CONSTRAINT valid_contact_type 
CHECK (contact_type IN ('visitor', 'member', 'born_again'));