-- Add PIN Code column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pin_code TEXT CHECK (length(pin_code) >= 4);

-- Comment
COMMENT ON COLUMN public.profiles.pin_code IS '4-6 digit PIN for quick access';
