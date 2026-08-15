-- Migration: Security, Audit Logging, Staff PIN Hardening, Slip Deduplication, and CRM Safe Search
-- Date: 2026-08-16
-- Description: Implement secure RPCs for staff PIN verification, immutable POS audit logs, slip fraud registry, and safe CRM member search.

-- ============================================================================
-- 1. SECURE STAFF PIN VERIFICATION & SAFE STAFF LIST
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_staff_pin_login(p_pin TEXT)
RETURNS TABLE (id UUID, display_name TEXT, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.display_name, p.role
    FROM public.profiles p
    WHERE p.pin = p_pin 
      AND p.role IN ('staff', 'admin')
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_list_safe()
RETURNS TABLE (id UUID, display_name TEXT, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.display_name, p.role
    FROM public.profiles p
    WHERE p.role IN ('staff', 'admin')
    ORDER BY p.role DESC, p.display_name ASC;
END;
$$;

-- ============================================================================
-- 2. POS AUDIT LOGS TABLE & LOGGING RPC
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pos_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id TEXT,
    staff_id UUID,
    staff_name TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'void_item', 'cancel_bill', 'manual_discount', 'cash_adjustment', 'open_drawer', 'override_price', 'split_payment'
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) DEFAULT 0.00,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pos_audit_logs_shift ON public.pos_audit_logs (shift_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_audit_logs_action ON public.pos_audit_logs (action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_audit_logs_booking ON public.pos_audit_logs (booking_id);

ALTER TABLE public.pos_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert pos_audit_logs" ON public.pos_audit_logs;
CREATE POLICY "Allow insert pos_audit_logs" ON public.pos_audit_logs
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read pos_audit_logs" ON public.pos_audit_logs;
CREATE POLICY "Allow read pos_audit_logs" ON public.pos_audit_logs
    FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.log_pos_audit_event(
    p_shift_id TEXT,
    p_staff_name TEXT,
    p_action_type TEXT,
    p_booking_id UUID DEFAULT NULL,
    p_amount NUMERIC DEFAULT 0.00,
    p_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_staff_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.pos_audit_logs (
        shift_id, staff_name, action_type, booking_id, amount, reason, metadata, staff_id
    ) VALUES (
        p_shift_id, p_staff_name, p_action_type, p_booking_id, p_amount, p_reason, p_metadata, p_staff_id
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- ============================================================================
-- 3. PAYMENT SLIPS REGISTRY & DEDUPLICATION RPC
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_slips_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    slip_hash TEXT,
    transfer_ref TEXT,
    amount NUMERIC(10, 2),
    uploaded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    is_verified BOOLEAN DEFAULT false,
    verified_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_slips_registry_file ON public.payment_slips_registry (file_name);
CREATE INDEX IF NOT EXISTS idx_slips_registry_ref ON public.payment_slips_registry (transfer_ref);
CREATE INDEX IF NOT EXISTS idx_slips_registry_booking ON public.payment_slips_registry (booking_id);

ALTER TABLE public.payment_slips_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read payment_slips_registry" ON public.payment_slips_registry;
CREATE POLICY "Allow public read payment_slips_registry" ON public.payment_slips_registry FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert payment_slips_registry" ON public.payment_slips_registry;
CREATE POLICY "Allow insert payment_slips_registry" ON public.payment_slips_registry FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.register_payment_slip(
    p_booking_id UUID,
    p_file_name TEXT,
    p_slip_hash TEXT DEFAULT NULL,
    p_transfer_ref TEXT DEFAULT NULL,
    p_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing RECORD;
BEGIN
    IF p_transfer_ref IS NOT NULL AND p_transfer_ref <> '' THEN
        SELECT * INTO v_existing FROM public.payment_slips_registry
        WHERE transfer_ref = p_transfer_ref AND booking_id <> p_booking_id
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'DUPLICATE_TRANSFER_REF', 
                'existing_booking_id', v_existing.booking_id
            );
        END IF;
    END IF;

    INSERT INTO public.payment_slips_registry (
        booking_id, file_name, slip_hash, transfer_ref, amount
    ) VALUES (
        p_booking_id, p_file_name, p_slip_hash, p_transfer_ref, p_amount
    )
    ON CONFLICT (file_name) DO UPDATE 
    SET booking_id = EXCLUDED.booking_id,
        slip_hash = COALESCE(EXCLUDED.slip_hash, payment_slips_registry.slip_hash),
        transfer_ref = COALESCE(EXCLUDED.transfer_ref, payment_slips_registry.transfer_ref);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 4. SAFE CRM MEMBER SEARCH (NO PIN EXPOSURE)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_member_crm_pos(p_term TEXT)
RETURNS TABLE (
    id UUID,
    display_name TEXT,
    nickname TEXT,
    phone_number TEXT,
    current_tier TEXT,
    xhaus_balance NUMERIC,
    drink_stamp_count INT,
    free_drink_quota INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean TEXT := TRIM(COALESCE(p_term, ''));
    v_norm_phone TEXT := REPLACE(REPLACE(v_clean, '-', ''), ' ', '');
BEGIN
    IF v_clean = '' THEN
        RETURN QUERY
        SELECT p.id, p.display_name, p.nickname, p.phone_number, p.current_tier, p.xhaus_balance, p.drink_stamp_count, p.free_drink_quota
        FROM public.profiles p
        ORDER BY p.created_at DESC
        LIMIT 40;
    ELSE
        RETURN QUERY
        SELECT p.id, p.display_name, p.nickname, p.phone_number, p.current_tier, p.xhaus_balance, p.drink_stamp_count, p.free_drink_quota
        FROM public.profiles p
        WHERE (v_norm_phone <> '' AND REPLACE(REPLACE(COALESCE(p.phone_number, ''), '-', ''), ' ', '') ILIKE '%' || v_norm_phone || '%')
           OR p.display_name ILIKE '%' || v_clean || '%'
           OR p.nickname ILIKE '%' || v_clean || '%'
        ORDER BY p.created_at DESC
        LIMIT 40;
    END IF;
END;
$$;
