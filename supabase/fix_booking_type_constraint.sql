-- Drop the existing constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_type_check;

-- Add the new constraint with 'steak' included
ALTER TABLE bookings ADD CONSTRAINT bookings_booking_type_check 
    CHECK (booking_type IN ('dine_in', 'pickup', 'steak', 'walk_in'));
