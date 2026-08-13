-- Migration: Optimize CRM SQL Functions & Performance Indexes
-- Date: 2026-08-13
-- Description: Enhances process_checkout_xhaus, process_drink_stamps, beverage category eligibility, and adds database performance indexes.

-- 1. Ensure performance indexes exist for CRM queries
CREATE INDEX IF NOT EXISTS idx_bookings_user_status_created ON public.bookings(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_booking_id ON public.order_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_xhaus_rewards_active ON public.xhaus_rewards(is_active, claim_code);

-- 2. Enhanced process_checkout_xhaus function
-- DROP previous function versions to allow changing return signature without 42P13 error
DROP FUNCTION IF EXISTS public.process_checkout_xhaus(UUID, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.process_checkout_xhaus;

CREATE OR REPLACE FUNCTION process_checkout_xhaus(
    p_booking_id UUID,
    p_xhaus_earned NUMERIC(10, 2),
    p_xhaus_redeemed NUMERIC(10, 2),
    p_xhaus_discount NUMERIC(10, 2)
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
    -- Find attached user from booking
    SELECT b.user_id INTO v_user_id FROM public.bookings b WHERE b.id = p_booking_id;

    -- Update booking xhaus records
    UPDATE public.bookings
    SET xhaus_earned = COALESCE(p_xhaus_earned, 0.00),
        xhaus_redeemed = COALESCE(p_xhaus_redeemed, 0.00),
        xhaus_discount = COALESCE(p_xhaus_discount, 0.00)
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

-- 3. Enhanced process_drink_stamps function
-- DROP previous function versions to allow changing signature seamlessly
DROP FUNCTION IF EXISTS public.process_drink_stamps(UUID, INT, INT);
DROP FUNCTION IF EXISTS public.process_drink_stamps;

CREATE OR REPLACE FUNCTION process_drink_stamps(
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

-- 4. Comprehensive beverage categories drink stamp eligibility update
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

-- Automatically set drink stamp eligibility on menu_items under eligible categories
UPDATE public.menu_items mi
SET is_drink_stamp_eligible = true
FROM public.menu_categories mc
WHERE mi.category_id = mc.id AND mc.is_drink_stamp_eligible = true;
