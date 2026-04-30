-- 1. Flyer fields on services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS flyer_url text,
  ADD COLUMN IF NOT EXISTS flyer_alt text;

-- 2. New public storage bucket for flyers
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-flyers', 'event-flyers', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies
CREATE POLICY "Public can view event flyers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-flyers');

CREATE POLICY "Admins and pastors can upload event flyers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-flyers'
    AND (authz.has_role(auth.uid(), 'admin'::app_role) OR authz.has_role(auth.uid(), 'pastor'::app_role))
  );

CREATE POLICY "Admins and pastors can update event flyers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-flyers'
    AND (authz.has_role(auth.uid(), 'admin'::app_role) OR authz.has_role(auth.uid(), 'pastor'::app_role))
  );

CREATE POLICY "Admins and pastors can delete event flyers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-flyers'
    AND (authz.has_role(auth.uid(), 'admin'::app_role) OR authz.has_role(auth.uid(), 'pastor'::app_role))
  );