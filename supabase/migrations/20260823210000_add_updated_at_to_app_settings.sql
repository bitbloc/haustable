-- Migration: Add updated_at to app_settings table and setup auto-update trigger
-- Date: 2026-08-23
-- Fixes: Supabase Postgres Error 42703: column app_settings.updated_at does not exist

-- 1. Add column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'app_settings' 
      AND column_name = 'updated_at'
  ) THEN 
    ALTER TABLE public.app_settings 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  END IF; 
END $$;

-- 2. Backfill existing records where updated_at is null
UPDATE public.app_settings 
SET updated_at = timezone('utc'::text, now()) 
WHERE updated_at IS NULL;

-- 3. Create or replace trigger function to auto-update updated_at timestamp on row update
CREATE OR REPLACE FUNCTION public.set_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach trigger to app_settings table
DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_app_settings_updated_at();
