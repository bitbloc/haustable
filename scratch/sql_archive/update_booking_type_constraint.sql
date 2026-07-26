-- Run this in your Supabase SQL Editor to allow 'walk_in' booking type

-- 1. Drop the existing constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_type_check;

-- 2. Add the new constraint with 'walk_in' added
ALTER TABLE bookings ADD CONSTRAINT bookings_booking_type_check 
CHECK (booking_type IN ('dine_in', 'pickup', 'walk_in'));
