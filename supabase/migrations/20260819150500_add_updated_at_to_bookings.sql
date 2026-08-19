-- Migration: Add updated_at to bookings table and setup auto-update trigger
-- Date: 2026-08-19
-- Fixes: Supabase error 42703: column bookings.updated_at does not exist

-- 1. Add column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'bookings' 
      AND column_name = 'updated_at'
  ) THEN 
    ALTER TABLE public.bookings 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  END IF; 
END $$;

-- 2. Backfill existing records where updated_at is null
UPDATE public.bookings 
SET updated_at = COALESCE(booking_time, created_at, timezone('utc'::text, now())) 
WHERE updated_at IS NULL;

-- 3. Create or replace trigger function to auto-update updated_at timestamp on row update
CREATE OR REPLACE FUNCTION public.set_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach trigger to bookings table
DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.set_bookings_updated_at();

-- 5. Add index for fast time-range queries (e.g. POS shift reports)
CREATE INDEX IF NOT EXISTS idx_bookings_updated_at 
ON public.bookings (updated_at DESC);
