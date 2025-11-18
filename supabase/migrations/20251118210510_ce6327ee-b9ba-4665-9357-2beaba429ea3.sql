-- Create test users using the admin API
-- Note: This is a one-time migration to create test users
-- In production, you would use the edge function with proper authentication

-- Insert admin test user profile (assuming auth.users entry already exists)
-- We'll need to create these users manually through the auth system or via the edge function

-- For now, we'll create a placeholder that can be updated once users are created
-- The edge function create-test-users should be called manually to create:
-- admin@test.com with password Admin123!
-- finance@test.com with password Finance123!

-- This migration just ensures the user_roles table is ready
-- The actual user creation must be done through Supabase Auth API