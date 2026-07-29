-- Migration script to add deposit_amount to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2) DEFAULT 0;
