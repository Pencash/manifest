-- Create test admin user
-- Note: This creates the auth user and their profile entry

-- First, let's insert into auth.users directly using the admin functions
-- We'll use the Supabase admin API to create these users

-- Create test users with specific emails and roles
-- Admin user: admin@test.com with password Admin123!
-- Finance user: finance@test.com with password Finance123!

-- Insert user roles for testing (these will be linked once users are created via Supabase Auth)
-- The actual user creation must be done through Supabase Auth API

-- This migration prepares the system for the test users
-- Run this SQL in Supabase SQL Editor to create the actual auth users:

/*
-- Run these in Supabase SQL Editor to create test users:

-- Admin user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@test.com',
  crypt('Admin123!', gen_salt('bf')),
  NOW(),
  '{"full_name": "Admin User", "phone": "+1234567890"}',
  NOW(),
  NOW(),
  '',
  ''
);

-- Finance user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'finance@test.com',
  crypt('Finance123!', gen_salt('bf')),
  NOW(),
  '{"full_name": "Finance User", "phone": "+1234567891"}',
  NOW(),
  NOW(),
  '',
  ''
);
*/

-- This is a placeholder migration since we cannot directly insert into auth schema