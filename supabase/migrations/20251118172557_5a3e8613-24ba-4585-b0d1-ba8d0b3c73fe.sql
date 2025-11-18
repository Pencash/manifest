-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('member', 'finance', 'pastor', 'admin');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  member_code TEXT,
  role public.app_role NOT NULL DEFAULT 'member',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies: members can view and update their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  service_date DATE NOT NULL,
  location TEXT,
  start_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Services are viewable by all authenticated users
CREATE POLICY "Authenticated users can view services"
  ON public.services FOR SELECT
  TO authenticated
  USING (true);

-- Create giving_types table
CREATE TABLE public.giving_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on giving_types
ALTER TABLE public.giving_types ENABLE ROW LEVEL SECURITY;

-- Giving types are viewable by all authenticated users
CREATE POLICY "Authenticated users can view giving types"
  ON public.giving_types FOR SELECT
  TO authenticated
  USING (true);

-- Insert default giving types
INSERT INTO public.giving_types (name, description) VALUES
  ('Tithe', 'Tithes and first tenth'),
  ('Offering', 'Freewill offerings'),
  ('First Fruit', 'First fruit offerings'),
  ('Pledge', 'Building or missions pledges');

-- Create givings table
CREATE TABLE public.givings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  giving_type_id UUID NOT NULL REFERENCES public.giving_types(id),
  service_id UUID REFERENCES public.services(id),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MWK',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'card')),
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  note TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on givings
ALTER TABLE public.givings ENABLE ROW LEVEL SECURITY;

-- Members can insert and view their own givings
CREATE POLICY "Users can insert their own givings"
  ON public.givings FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can view their own givings"
  ON public.givings FOR SELECT
  USING (auth.uid() = profile_id);

-- Finance and admin roles can view all givings
CREATE POLICY "Finance and admin can view all givings"
  ON public.givings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('finance', 'admin')
    )
  );

-- Create receipts table
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giving_id UUID NOT NULL REFERENCES public.givings(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  parsed_amount NUMERIC(12,2),
  parsed_currency TEXT,
  parsed_date DATE,
  parsed_reference TEXT,
  raw_ocr_text TEXT,
  parse_status TEXT NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending', 'success', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on receipts
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Members can insert and view receipts for their own givings
CREATE POLICY "Users can insert receipts for their own givings"
  ON public.receipts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.givings
      WHERE givings.id = receipts.giving_id
      AND givings.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can view receipts for their own givings"
  ON public.receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.givings
      WHERE givings.id = receipts.giving_id
      AND givings.profile_id = auth.uid()
    )
  );

-- Finance and admin can view all receipts
CREATE POLICY "Finance and admin can view all receipts"
  ON public.receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('finance', 'admin')
    )
  );

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'online')),
  count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, profile_id)
);

-- Enable RLS on attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Members can view their own attendance
CREATE POLICY "Users can view their own attendance"
  ON public.attendance FOR SELECT
  USING (auth.uid() = profile_id);

-- Finance and admin can manage all attendance
CREATE POLICY "Finance and admin can manage attendance"
  ON public.attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('finance', 'admin')
    )
  );

-- Create testimonies table
CREATE TABLE public.testimonies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  title TEXT,
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'pastoral_team' CHECK (visibility IN ('pastoral_team', 'admin_only', 'public')),
  is_anonymous_to_congregation BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on testimonies
ALTER TABLE public.testimonies ENABLE ROW LEVEL SECURITY;

-- Members can insert and view their own testimonies
CREATE POLICY "Users can insert their own testimonies"
  ON public.testimonies FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can view their own testimonies"
  ON public.testimonies FOR SELECT
  USING (auth.uid() = profile_id);

-- Pastoral team can view testimonies based on visibility
CREATE POLICY "Pastoral team can view testimonies"
  ON public.testimonies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('pastor', 'admin')
      AND (
        testimonies.visibility IN ('pastoral_team', 'public')
        OR (testimonies.visibility = 'admin_only' AND profiles.role = 'admin')
      )
    )
  );

-- Create prayer_requests table
CREATE TABLE public.prayer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  title TEXT,
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'pastoral_team' CHECK (visibility IN ('pastoral_team', 'admin_only', 'public')),
  is_anonymous_to_congregation BOOLEAN NOT NULL DEFAULT false,
  answered BOOLEAN NOT NULL DEFAULT false,
  follow_up_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on prayer_requests
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

-- Members can insert and view their own prayer requests
CREATE POLICY "Users can insert their own prayer requests"
  ON public.prayer_requests FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can view their own prayer requests"
  ON public.prayer_requests FOR SELECT
  USING (auth.uid() = profile_id);

-- Pastoral team can view and manage prayer requests based on visibility
CREATE POLICY "Pastoral team can view prayer requests"
  ON public.prayer_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('pastor', 'admin')
      AND (
        prayer_requests.visibility IN ('pastoral_team', 'public')
        OR (prayer_requests.visibility = 'admin_only' AND profiles.role = 'admin')
      )
    )
  );

CREATE POLICY "Pastoral team can update prayer requests"
  ON public.prayer_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('pastor', 'admin')
    )
  );

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false);

-- Create storage policies for receipts bucket
CREATE POLICY "Users can upload their own receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Finance and admin can view all receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('finance', 'admin')
    )
  );

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();