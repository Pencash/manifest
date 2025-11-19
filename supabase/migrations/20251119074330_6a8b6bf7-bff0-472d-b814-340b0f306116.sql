-- Create contacts table for visitors and non-authenticated members
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  member_code TEXT,
  contact_type TEXT NOT NULL DEFAULT 'visitor', -- 'visitor' or 'member'
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  first_visit_date DATE,
  last_visit_date DATE,
  visit_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contacts
CREATE POLICY "Admin can manage contacts"
ON public.contacts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'pastor'::app_role));

-- Add contact_id to attendance table (nullable, for visitors)
ALTER TABLE public.attendance 
ADD COLUMN contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE;

-- Update attendance constraint to allow either profile_id or contact_id
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_profile_id_fkey;

ALTER TABLE public.attendance 
ALTER COLUMN profile_id DROP NOT NULL;

-- Add constraint to ensure either profile_id or contact_id is set
ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_person_check 
CHECK (
  (profile_id IS NOT NULL AND contact_id IS NULL) OR 
  (profile_id IS NULL AND contact_id IS NOT NULL)
);

-- Create event reminders table
CREATE TABLE public.event_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- 'email' or 'sms'
  send_before_hours INTEGER NOT NULL, -- hours before event
  message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage reminders"
ON public.event_reminders
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pastor'::app_role));

-- Create visitor follow-ups table
CREATE TABLE public.visitor_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  follow_up_type TEXT NOT NULL, -- 'call', 'email', 'visit', 'message'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
  scheduled_date DATE,
  completed_date DATE,
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.visitor_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pastoral team can manage followups"
ON public.visitor_followups
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pastor'::app_role));

-- Create indexes for performance
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_contacts_type ON public.contacts(contact_type);
CREATE INDEX idx_attendance_contact_id ON public.attendance(contact_id);
CREATE INDEX idx_event_reminders_service ON public.event_reminders(service_id);
CREATE INDEX idx_visitor_followups_contact ON public.visitor_followups(contact_id);
CREATE INDEX idx_visitor_followups_status ON public.visitor_followups(status);

-- Create trigger to update contacts updated_at
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION update_contacts_updated_at();

-- Create trigger to update visitor_followups updated_at
CREATE TRIGGER followups_updated_at
BEFORE UPDATE ON public.visitor_followups
FOR EACH ROW
EXECUTE FUNCTION update_contacts_updated_at();