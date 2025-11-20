-- Add rejection_reason column to givings table for tracking why payments were rejected
ALTER TABLE public.givings 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;