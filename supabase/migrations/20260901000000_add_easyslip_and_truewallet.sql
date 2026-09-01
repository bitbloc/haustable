-- Migration: Add EasySlip auto slip verification columns & TrueMoney Wallet settings

-- 1. Add slip verification columns to bookings table if not existing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'slip_verified') THEN
        ALTER TABLE public.bookings ADD COLUMN slip_verified BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'slip_verified_at') THEN
        ALTER TABLE public.bookings ADD COLUMN slip_verified_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'slip_provider') THEN
        ALTER TABLE public.bookings ADD COLUMN slip_provider TEXT; -- 'bank' | 'truewallet'
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'slip_trans_ref') THEN
        ALTER TABLE public.bookings ADD COLUMN slip_trans_ref TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'slip_verification_status') THEN
        ALTER TABLE public.bookings ADD COLUMN slip_verification_status TEXT DEFAULT 'pending'; -- 'auto_verified' | 'manual_pending' | 'amount_mismatch' | 'rejected'
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'slip_verified_data') THEN
        ALTER TABLE public.bookings ADD COLUMN slip_verified_data JSONB;
    END IF;
END $$;

-- 2. Insert default app_settings for EasySlip and TrueMoney Wallet
INSERT INTO public.app_settings (key, value)
VALUES 
    ('easyslip_api_key', 'e0650eb6-a4c8-4e25-b109-54bf3a10256e'),
    ('easyslip_enabled_pickup', 'true'),
    ('easyslip_enabled_booking', 'true'),
    ('truewallet_phone', ''),
    ('truewallet_account_name', ''),
    ('truewallet_qr_url', '')
ON CONFLICT (key) DO NOTHING;
