-- ==============================================================================
-- Migration: Add customer_name and phone_number columns to public.bookings
-- Purpose: Prevent Postgres error 42703 (undefined_column) when external queries, 
--          dashboards, or integrations query bookings.customer_name or bookings.phone_number.
-- Date: 2026-09-04
-- ==============================================================================

-- 1. Add columns to public.bookings if they don't exist
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- 2. Backfill existing historical rows
UPDATE public.bookings 
SET 
    customer_name = COALESCE(customer_name, pickup_contact_name),
    phone_number = COALESCE(phone_number, pickup_contact_phone),
    customer_phone = COALESCE(customer_phone, pickup_contact_phone)
WHERE 
    customer_name IS NULL 
    OR phone_number IS NULL 
    OR customer_phone IS NULL;

-- 3. Trigger Function to automatically synchronize contact columns
CREATE OR REPLACE FUNCTION public.sync_booking_contact_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Synchronize Customer Name
    IF NEW.pickup_contact_name IS NOT NULL AND (NEW.customer_name IS NULL OR NEW.customer_name = '') THEN
        NEW.customer_name := NEW.pickup_contact_name;
    ELSIF NEW.customer_name IS NOT NULL AND (NEW.pickup_contact_name IS NULL OR NEW.pickup_contact_name = '') THEN
        NEW.pickup_contact_name := NEW.customer_name;
    END IF;

    -- Synchronize Phone Number
    IF NEW.pickup_contact_phone IS NOT NULL AND (NEW.phone_number IS NULL OR NEW.phone_number = '') THEN
        NEW.phone_number := NEW.pickup_contact_phone;
    ELSIF NEW.phone_number IS NOT NULL AND (NEW.pickup_contact_phone IS NULL OR NEW.pickup_contact_phone = '') THEN
        NEW.pickup_contact_phone := NEW.phone_number;
    END IF;

    -- Synchronize Customer Phone alias
    IF NEW.customer_phone IS NULL OR NEW.customer_phone = '' THEN
        NEW.customer_phone := COALESCE(NEW.phone_number, NEW.pickup_contact_phone);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger on bookings table
DROP TRIGGER IF EXISTS trg_sync_booking_contact_columns ON public.bookings;
CREATE TRIGGER trg_sync_booking_contact_columns
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.sync_booking_contact_columns();

-- 5. Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
