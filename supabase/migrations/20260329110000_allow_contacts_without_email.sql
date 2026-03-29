-- Allow attendance contacts without email address.
ALTER TABLE public.contacts
  ALTER COLUMN email DROP NOT NULL;
