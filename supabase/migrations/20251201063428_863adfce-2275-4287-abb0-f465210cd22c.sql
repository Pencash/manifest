-- Make invitee_phone nullable (phone is now optional)
ALTER TABLE public.member_invitations 
ALTER COLUMN invitee_phone DROP NOT NULL;