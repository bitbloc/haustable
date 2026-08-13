-- Migration: Complete CRM System, Tier Privileges, Drink Stamps & Performance Indexes
-- Date: 2026-08-13
-- Description: Consolidated CRM update script including performance indexes, get_member_tier_details, process_checkout_xhaus, process_drink_stamps, and beverage eligibility.

-- 1. Performance Indexes for CRM & Rewards Queries
CREATE INDEX IF NOT EXISTS idx_bookings_user_status_created ON public.bookings(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_booking_id ON public.order_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_xhaus_rewards_active ON public.xhaus_rewards(is_active, claim_code);

-- 2. Enhanced get_member_tier_details function with discount_rate column
DROP FUNCTION IF EXISTS public.get_member_tier_details(UUID);
DROP FUNCTION IF EXISTS public.get_member_tier_details;

CREATE OR REPLACE FUNCTION public.get_member_tier_details(p_user_id UUID)
RETURNS TABLE (
    accumulated_spent_12m NUMERIC(10, 2),
    accumulated_spent_13m NUMERIC(10, 2),
    current_tier TEXT,
    multiplier NUMERIC(3, 2),
    discount_rate NUMERIC(3, 2),
    is_in_grace_period BOOLEAN
) AS $$
DECLARE
    v_spent_12m NUMERIC(10, 2);
    v_spent_13m NUMERIC(10, 2);
    v_tier TEXT;
    v_mult NUMERIC(3, 2);
    v_disc NUMERIC(3, 2);
    v_grace BOOLEAN := false;
BEGIN
    -- Sum of net totals (final bill total_amount) in last 12 months (365 days)
    SELECT COALESCE(SUM(total_amount), 0.00)
    INTO v_spent_12m
    FROM public.bookings
    WHERE user_id = p_user_id AND status = 'completed' AND created_at >= NOW() - INTERVAL '12 months';

    -- Sum of net totals in last 13 months (12 months + 30 days grace period)
    SELECT COALESCE(SUM(total_amount), 0.00)
    INTO v_spent_13m
    FROM public.bookings
    WHERE user_id = p_user_id AND status = 'completed' AND created_at >= NOW() - INTERVAL '13 months';

    -- Settle tier and privileges based on customer's exact relationship rules (Point-only model, 0% bill discount)
    IF v_spent_12m >= 12000.00 THEN
        v_tier := 'Inner Haus';
        v_mult := 1.50;
        v_disc := 0.00; -- 0% privilege discount (Point collection only x1.5)
    ELSIF v_spent_13m >= 12000.00 THEN
        v_tier := 'Inner Haus';
        v_mult := 1.50;
        v_disc := 0.00; -- 0% privilege discount (Point collection only x1.5)
        v_grace := true;
    ELSIF v_spent_12m >= 4000.00 THEN
        v_tier := 'Haus People';
        v_mult := 1.25;
        v_disc := 0.00; -- 0% privilege discount (Point collection only x1.25)
    ELSIF v_spent_13m >= 4000.00 THEN
        v_tier := 'Haus People';
        v_mult := 1.25;
        v_disc := 0.00; -- 0% privilege discount (Point collection only x1.25)
        v_grace := true;
    ELSE
        v_tier := 'Haus Common';
        v_mult := 1.00;
        v_disc := 0.00; -- 0% privilege discount (Point collection only x1.0)
    END IF;

    RETURN QUERY SELECT v_spent_12m, v_spent_13m, v_tier, v_mult, v_disc, v_grace;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Enhanced process_checkout_xhaus function accepting optional p_user_id
DROP FUNCTION IF EXISTS public.process_checkout_xhaus(UUID, NUMERIC, NUMERIC, NUMERIC, UUID);
DROP FUNCTION IF EXISTS public.process_checkout_xhaus(UUID, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.process_checkout_xhaus;

CREATE OR REPLACE FUNCTION public.process_checkout_xhaus(
    p_booking_id UUID,
    p_xhaus_earned NUMERIC(10, 2),
    p_xhaus_redeemed NUMERIC(10, 2),
    p_xhaus_discount NUMERIC(10, 2),
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    user_id UUID,
    new_balance NUMERIC(10, 2)
) AS $$
DECLARE
    v_user_id UUID;
    v_new_balance NUMERIC(10, 2) := 0.00;
BEGIN
    -- Find attached user from parameter or booking
    IF p_user_id IS NOT NULL THEN
        v_user_id := p_user_id;
    ELSE
        SELECT b.user_id INTO v_user_id FROM public.bookings b WHERE b.id = p_booking_id;
    END IF;

    -- Update booking xhaus records and ensure user_id is set
    UPDATE public.bookings
    SET xhaus_earned = COALESCE(p_xhaus_earned, 0.00),
        xhaus_redeemed = COALESCE(p_xhaus_redeemed, 0.00),
        xhaus_discount = COALESCE(p_xhaus_discount, 0.00),
        user_id = COALESCE(user_id, v_user_id)
    WHERE id = p_booking_id;

    -- Update profile points balance safely (preventing negative values)
    IF v_user_id IS NOT NULL THEN
        UPDATE public.profiles
        SET xhaus_balance = GREATEST(0.00, COALESCE(xhaus_balance, 0.00) + COALESCE(p_xhaus_earned, 0.00) - COALESCE(p_xhaus_redeemed, 0.00)),
            total_earned_xhaus = COALESCE(total_earned_xhaus, 0.00) + COALESCE(p_xhaus_earned, 0.00),
            total_redeemed_xhaus = COALESCE(total_redeemed_xhaus, 0.00) + COALESCE(p_xhaus_redeemed, 0.00)
        WHERE id = v_user_id
        RETURNING xhaus_balance INTO v_new_balance;
    END IF;

    RETURN QUERY SELECT true, v_user_id, v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enhanced process_drink_stamps atomic function
DROP FUNCTION IF EXISTS public.process_drink_stamps(UUID, INT, INT);
DROP FUNCTION IF EXISTS public.process_drink_stamps;

CREATE OR REPLACE FUNCTION public.process_drink_stamps(
    p_user_id UUID,
    p_stamp_count INT,
    p_quota_used INT DEFAULT 0
) RETURNS TABLE (
    new_stamp_count INT,
    new_free_quota INT
) AS $$
DECLARE
    v_current_stamps INT := 0;
    v_current_quota INT := 0;
    v_total_stamps INT := 0;
    v_earned_quota INT := 0;
    v_final_stamps INT := 0;
    v_final_quota INT := 0;
BEGIN
    -- Lock profile for update
    SELECT COALESCE(drink_stamp_count, 0), COALESCE(free_drink_quota, 0)
    INTO v_current_stamps, v_current_quota
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF FOUND THEN
        v_total_stamps := v_current_stamps + GREATEST(0, p_stamp_count);
        v_earned_quota := floor(v_total_stamps / 10);
        v_final_stamps := v_total_stamps % 10;
        v_final_quota := GREATEST(0, v_current_quota - GREATEST(0, p_quota_used) + v_earned_quota);

        UPDATE public.profiles
        SET drink_stamp_count = v_final_stamps,
            free_drink_quota = v_final_quota,
            total_drinks_purchased = COALESCE(total_drinks_purchased, 0) + GREATEST(0, p_stamp_count)
        WHERE id = p_user_id;
    END IF;

    RETURN QUERY SELECT v_final_stamps, v_final_quota;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Mark all beverage categories & menu items eligible for drink stamps
UPDATE public.menu_categories 
SET is_drink_stamp_eligible = true 
WHERE LOWER(name) LIKE '%coffee%' 
   OR LOWER(name) LIKE '%tea%' 
   OR LOWER(name) LIKE '%beverage%' 
   OR LOWER(name) LIKE '%drink%' 
   OR LOWER(name) LIKE '%soda%'
   OR LOWER(name) LIKE '%matcha%'
   OR LOWER(name) LIKE '%cocoa%'
   OR LOWER(name) LIKE '%latte%'
   OR LOWER(name) LIKE '%espresso%'
   OR LOWER(name) LIKE '%brew%'
   OR LOWER(name) LIKE '%smoothie%'
   OR LOWER(name) LIKE '%frappe%'
   OR LOWER(name) LIKE '%juice%'
   OR LOWER(name) LIKE '%milk%'
   OR LOWER(name) LIKE '%non-coffee%'
   OR LOWER(name) LIKE '%ชา%'
   OR LOWER(name) LIKE '%กาแฟ%'
   OR LOWER(name) LIKE '%เครื่องดื่ม%'
   OR LOWER(name) LIKE '%นมสด%'
   OR LOWER(name) LIKE '%มัทฉะ%'
   OR LOWER(name) LIKE '%โกโก้%'
   OR LOWER(name) LIKE '%น้ำผลไม้%'
   OR LOWER(name) LIKE '%โซดา%';

UPDATE public.menu_items mi
SET is_drink_stamp_eligible = true
FROM public.menu_categories mc
WHERE mi.category_id = mc.id AND mc.is_drink_stamp_eligible = true;
