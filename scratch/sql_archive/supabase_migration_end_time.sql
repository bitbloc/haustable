-- Run this in your Supabase SQL Editor

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS end_time timestamptz;

-- Optional: Set default end_time for existing records to +2 hours
UPDATE bookings 
SET end_time = booking_time + interval '2 hours' 
WHERE end_time IS NULL;
