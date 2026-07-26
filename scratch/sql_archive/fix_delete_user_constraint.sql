-- Fix User Deletion Error
-- The error "violates foreign key constraint bookings_user_id_fkey" happens because we cannot delete a user who has bookings.
-- This script changes the behavior to "SET NULL", meaning if a user is deleted, their bookings remain but the user_id becomes NULL.

-- 1. Make user_id nullable (just in case it isn't)
ALTER TABLE public.bookings ALTER COLUMN user_id DROP NOT NULL;

-- 2. Drop the existing strict constraint
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;

-- 3. Add the new constraint with ON DELETE SET NULL
-- Note: Assuming user_id references profiles(id). The error message suggests this link.
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;
