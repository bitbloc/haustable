-- Add updated_at column to bookings table and setup auto-update trigger
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

-- Backfill existing records
UPDATE public.bookings 
SET updated_at = COALESCE(booking_time, created_at, timezone('utc'::text, now())) 
WHERE updated_at IS NULL;

-- Trigger function for auto-updating timestamp
CREATE OR REPLACE FUNCTION public.set_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on update
DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.set_bookings_updated_at();

-- Index for POS reporting
CREATE INDEX IF NOT EXISTS idx_bookings_updated_at 
ON public.bookings (updated_at DESC);
