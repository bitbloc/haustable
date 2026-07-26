-- Add columns for Magic Link Tracking System
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS tracking_token text UNIQUE,
ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

-- Create Index for fast lookup by token
CREATE INDEX IF NOT EXISTS idx_bookings_tracking_token ON bookings(tracking_token);

-- Enable UUID extension if not already enabled (needed for uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to auto-generate tracking_token and expiry
CREATE OR REPLACE FUNCTION generate_booking_tracking_info()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate tracking_token if not provided
    IF NEW.tracking_token IS NULL THEN
        NEW.tracking_token := uuid_generate_v4();
    END IF;

    -- Set token_expires_at if not provided (Default: 24 hours after booking_time)
    -- If booking_time is null (shouldn't be, but just in case), use now() + 24h
    IF NEW.token_expires_at IS NULL THEN
        IF NEW.booking_time IS NOT NULL THEN
            NEW.token_expires_at := NEW.booking_time + interval '24 hours';
        ELSE
            NEW.token_expires_at := now() + interval '24 hours';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create Trigger (Before Insert)
DROP TRIGGER IF EXISTS trg_generate_booking_tracking_info ON bookings;
CREATE TRIGGER trg_generate_booking_tracking_info
BEFORE INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION generate_booking_tracking_info();
