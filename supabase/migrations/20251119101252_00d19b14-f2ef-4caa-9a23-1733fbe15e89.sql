-- Create member_invitations table for tracking invited friends
CREATE TABLE public.member_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invitee_name TEXT NOT NULL,
  invitee_phone TEXT NOT NULL,
  invitee_email TEXT,
  target_service_id UUID REFERENCES public.services(id),
  status TEXT NOT NULL DEFAULT 'pending_invite' CHECK (status IN ('pending_invite', 'invited', 'confirmed', 'attended')),
  invitation_method TEXT CHECK (invitation_method IN ('sms', 'whatsapp', 'call', 'email', 'in_person')),
  notes TEXT,
  invited_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  attended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;

-- Members can manage their own invitations
CREATE POLICY "Members manage own invitations"
  ON public.member_invitations FOR ALL
  USING (auth.uid() = member_id)
  WITH CHECK (auth.uid() = member_id);

-- Admin/Pastor can view all invitations
CREATE POLICY "Admin view all invitations"
  ON public.member_invitations FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'pastor'));

-- Create mobilization_targets table
CREATE TABLE public.mobilization_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES public.services(id) NOT NULL,
  target_invitations INTEGER NOT NULL,
  target_confirmations INTEGER NOT NULL,
  set_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mobilization_targets ENABLE ROW LEVEL SECURITY;

-- Only admin/pastor can manage targets
CREATE POLICY "Admin manage targets"
  ON public.mobilization_targets FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'pastor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'pastor'));

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_member_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_member_invitations_updated_at
  BEFORE UPDATE ON public.member_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_member_invitations_updated_at();