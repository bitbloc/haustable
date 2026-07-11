-- Add pin column to profiles table for staff logins
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin TEXT;
