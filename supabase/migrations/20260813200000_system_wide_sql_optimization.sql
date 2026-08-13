-- Migration: System-Wide High Performance SQL Optimization (Comprehensive Master CRM, Arcade, Stock & Performance Script)
-- Date: 2026-08-13
-- Description: Complete 100% consolidated database setup script including Schema Columns, Default Settings, Expression Indexes, Welcome Bonus, Member Auto-Linking, Tier Details, Service History, Atomic Checkout, 10-Free-1 Drink Stamps, Reward Usage Limits, Arcade Rewards, and Stock Management.

-- ============================================================================
-- SECTION 1. DATABASE COLUMNS & SCHEMA ENHANCEMENTS
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xhaus_balance NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_earned_xhaus NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_redeemed_xhaus NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS drink_stamp_count INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_drink_quota INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_drinks_purchased INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_tier TEXT DEFAULT 'Haus Common';

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS xhaus_earned NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS xhaus_redeemed NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS xhaus_discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS xhaus_reward_id UUID;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10, 2) DEFAULT 0.00;

ALTER TABLE public.xhaus_rewards ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT NULL;
ALTER TABLE public.xhaus_rewards ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0 NOT NULL;

-- Default CRM Settings in app_settings table
INSERT INTO public.app_settings (key, value) VALUES 
('crm_welcome_xhaus', '10.00'),
('crm_redeem_rate_xhaus', '1.00'),
('crm_min_redeem_xhaus', '10.00')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- SECTION 2. FUNCTIONAL & EXPRESSION INDEXES (ZERO FULL TABLE SCANS)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_norm_phone 
ON public.profiles ((REPLACE(REPLACE(COALESCE(phone_number, ''), '-', ''), ' ', '')));

CREATE INDEX IF NOT EXISTS idx_profiles_lower_name 
ON public.profiles ((LOWER(TRIM(COALESCE(display_name, '')))));

CREATE INDEX IF NOT EXISTS idx_profiles_lower_nickname 
ON public.profiles ((LOWER(TRIM(COALESCE(nickname, '')))));

CREATE INDEX IF NOT EXISTS idx_bookings_norm_phone 
ON public.bookings ((REPLACE(REPLACE(COALESCE(pickup_contact_phone, ''), '-', ''), ' ', '')));

CREATE INDEX IF NOT EXISTS idx_bookings_lower_name 
ON public.bookings ((LOWER(TRIM(COALESCE(pickup_contact_name, '')))));

CREATE INDEX IF NOT EXISTS idx_bookings_user_status_created 
ON public.bookings (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_booking_menu 
ON public.order_items (booking_id, menu_item_id);

CREATE INDEX IF NOT EXISTS idx_pos_shifts_status_opened 
ON public.pos_shifts (status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_items_category 
ON public.stock_items (category);

CREATE INDEX IF NOT EXISTS idx_arcade_rewards_profile_created 
ON public.arcade_rewards_log (profile_id, created_at DESC);

-- ============================================================================
-- SECTION 3. CRM WELCOME BONUS TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.grant_welcome_xhaus()
RETURNS TRIGGER AS $$
DECLARE
    v_welcome_val NUMERIC(10, 2);
BEGIN
    SELECT COALESCE(value::NUMERIC, 10.00) INTO v_welcome_val 
    FROM public.app_settings 
    WHERE key = 'crm_welcome_xhaus';
    
    NEW.xhaus_balance := COALESCE(NEW.xhaus_balance, 0.00) + v_welcome_val;
    NEW.total_earned_xhaus := COALESCE(NEW.total_earned_xhaus, 0.00) + v_welcome_val;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_welcome_xhaus ON public.profiles;
CREATE TRIGGER on_profile_created_welcome_xhaus
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.grant_welcome_xhaus();

-- ============================================================================
-- SECTION 4. BI-DIRECTIONAL MEMBER AUTO-LINK TRIGGERS
-- ============================================================================
-- A. Trigger on public.bookings (Auto-link when order is inserted or updated)
CREATE OR REPLACE FUNCTION public.auto_link_booking_member()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_id UUID := NULL;
    v_phone TEXT;
    v_name TEXT;
BEGIN
    IF NEW.user_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    v_phone := NULLIF(REPLACE(REPLACE(COALESCE(NEW.pickup_contact_phone, ''), '-', ''), ' ', ''), '');
    v_name := NULLIF(LOWER(TRIM(COALESCE(NEW.pickup_contact_name, ''))), '');

    IF v_phone IS NOT NULL THEN
        SELECT id INTO v_profile_id
        FROM public.profiles
        WHERE REPLACE(REPLACE(COALESCE(phone_number, ''), '-', ''), ' ', '') = v_phone
        LIMIT 1;
    END IF;

    IF v_profile_id IS NULL AND v_name IS NOT NULL AND LENGTH(v_name) >= 2 THEN
        SELECT id INTO v_profile_id
        FROM public.profiles
        WHERE LOWER(TRIM(COALESCE(display_name, ''))) = v_name
           OR LOWER(TRIM(COALESCE(nickname, ''))) = v_name
        LIMIT 1;
    END IF;

    IF v_profile_id IS NOT NULL THEN
        NEW.user_id := v_profile_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_link_booking_member ON public.bookings;
CREATE TRIGGER trg_auto_link_booking_member
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_booking_member();

-- B. Trigger on public.profiles (Auto-link historical unlinked bookings when a profile is created or updated)
CREATE OR REPLACE FUNCTION public.auto_link_profile_bookings()
RETURNS TRIGGER AS $$
DECLARE
    v_phone TEXT;
    v_name TEXT;
    v_nickname TEXT;
BEGIN
    v_phone := NULLIF(REPLACE(REPLACE(COALESCE(NEW.phone_number, ''), '-', ''), ' ', ''), '');
    v_name := NULLIF(LOWER(TRIM(COALESCE(NEW.display_name, ''))), '');
    v_nickname := NULLIF(LOWER(TRIM(COALESCE(NEW.nickname, ''))), '');

    UPDATE public.bookings b
    SET user_id = NEW.id
    WHERE b.user_id IS NULL
      AND (
        (v_phone IS NOT NULL AND b.pickup_contact_phone IS NOT NULL AND REPLACE(REPLACE(b.pickup_contact_phone, '-', ''), ' ', '') = v_phone)
        OR (v_name IS NOT NULL AND b.pickup_contact_name IS NOT NULL AND LOWER(TRIM(b.pickup_contact_name)) = v_name)
        OR (v_nickname IS NOT NULL AND b.pickup_contact_name IS NOT NULL AND LOWER(TRIM(b.pickup_contact_name)) = v_nickname)
      );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_link_profile_bookings ON public.profiles;
CREATE TRIGGER trg_auto_link_profile_bookings
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_profile_bookings();

-- C. Bulk auto-link all existing historical bookings right now
UPDATE public.bookings b
SET user_id = p.id
FROM public.profiles p
WHERE b.user_id IS NULL
  AND (
    (b.pickup_contact_phone IS NOT NULL AND REPLACE(REPLACE(b.pickup_contact_phone, '-', ''), ' ', '') = REPLACE(REPLACE(p.phone_number, '-', ''), ' ', ''))
    OR (b.pickup_contact_name IS NOT NULL AND LOWER(TRIM(b.pickup_contact_name)) = LOWER(TRIM(p.display_name)))
    OR (p.nickname IS NOT NULL AND p.nickname != '' AND LOWER(TRIM(COALESCE(b.pickup_contact_name, ''))) = LOWER(TRIM(p.nickname)))
  );

-- ============================================================================
-- SECTION 5. MEMBER TIER DETAILS & SERVICE HISTORY RPC FUNCTIONS
-- ============================================================================
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
    v_phone TEXT;
    v_name TEXT;
    v_nickname TEXT;
    v_spent_12m NUMERIC(10, 2) := 0.00;
    v_spent_13m NUMERIC(10, 2) := 0.00;
    v_tier TEXT;
    v_mult NUMERIC(3, 2);
    v_disc NUMERIC(3, 2);
    v_grace BOOLEAN := false;
BEGIN
    SELECT 
        NULLIF(REPLACE(REPLACE(COALESCE(phone_number, ''), '-', ''), ' ', ''), ''),
        NULLIF(LOWER(TRIM(COALESCE(display_name, ''))), ''),
        NULLIF(LOWER(TRIM(COALESCE(nickname, ''))), '')
    INTO v_phone, v_name, v_nickname
    FROM public.profiles
    WHERE id = p_user_id;

    SELECT 
        COALESCE(SUM(CASE WHEN b.created_at >= NOW() - INTERVAL '12 months' THEN b.total_amount ELSE 0 END), 0.00),
        COALESCE(SUM(b.total_amount), 0.00)
    INTO v_spent_12m, v_spent_13m
    FROM public.bookings b
    WHERE (
        b.user_id = p_user_id
        OR (
            b.user_id IS NULL AND (
                (v_phone IS NOT NULL AND b.pickup_contact_phone IS NOT NULL AND REPLACE(REPLACE(b.pickup_contact_phone, '-', ''), ' ', '') = v_phone)
                OR (v_name IS NOT NULL AND b.pickup_contact_name IS NOT NULL AND LOWER(TRIM(b.pickup_contact_name)) = v_name)
                OR (v_nickname IS NOT NULL AND b.pickup_contact_name IS NOT NULL AND LOWER(TRIM(b.pickup_contact_name)) = v_nickname)
            )
        )
    )
    AND b.status = 'completed' 
    AND b.created_at >= NOW() - INTERVAL '13 months';

    IF v_spent_12m >= 12000.00 THEN
        v_tier := 'Inner Haus';
        v_mult := 1.50;
        v_disc := 0.00;
    ELSIF v_spent_13m >= 12000.00 THEN
        v_tier := 'Inner Haus';
        v_mult := 1.50;
        v_disc := 0.00;
        v_grace := true;
    ELSIF v_spent_12m >= 4000.00 THEN
        v_tier := 'Haus People';
        v_mult := 1.25;
        v_disc := 0.00;
    ELSIF v_spent_13m >= 4000.00 THEN
        v_tier := 'Haus People';
        v_mult := 1.25;
        v_disc := 0.00;
        v_grace := true;
    ELSE
        v_tier := 'Haus Common';
        v_mult := 1.00;
        v_disc := 0.00;
    END IF;

    RETURN QUERY SELECT v_spent_12m, v_spent_13m, v_tier, v_mult, v_disc, v_grace;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.get_member_service_history(UUID);
DROP FUNCTION IF EXISTS public.get_member_service_history;

CREATE OR REPLACE FUNCTION public.get_member_service_history(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_phone TEXT;
    v_name TEXT;
    v_nickname TEXT;
    v_result JSONB;
BEGIN
    SELECT 
        NULLIF(REPLACE(REPLACE(COALESCE(phone_number, ''), '-', ''), ' ', ''), ''),
        NULLIF(LOWER(TRIM(COALESCE(display_name, ''))), ''),
        NULLIF(LOWER(TRIM(COALESCE(nickname, ''))), '')
    INTO v_phone, v_name, v_nickname
    FROM public.profiles
    WHERE id = p_user_id;

    SELECT COALESCE(jsonb_agg(h ORDER BY (h->>'created_at') DESC), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT 
            jsonb_build_object(
                'id', b.id,
                'created_at', b.created_at,
                'booking_time', b.booking_time,
                'booking_type', b.booking_type,
                'status', b.status,
                'total_amount', COALESCE(b.total_amount, 0),
                'xhaus_earned', COALESCE(b.xhaus_earned, 0),
                'xhaus_redeemed', COALESCE(b.xhaus_redeemed, 0),
                'xhaus_discount', COALESCE(b.xhaus_discount, 0),
                'table_name', t.table_name,
                'source', 'booking',
                'order_items', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'id', oi.id,
                            'name', COALESCE(m.name, 'รายการสินค้า'),
                            'quantity', oi.quantity,
                            'price_at_time', oi.price_at_time
                        )
                    ), '[]'::jsonb)
                    FROM public.order_items oi
                    LEFT JOIN public.menu_items m ON oi.menu_item_id = m.id
                    WHERE oi.booking_id = b.id
                )
            ) AS h
        FROM public.bookings b
        LEFT JOIN public.tables_layout t ON b.table_id = t.id
        WHERE (
            b.user_id = p_user_id
            OR (
                b.user_id IS NULL AND (
                    (v_phone IS NOT NULL AND b.pickup_contact_phone IS NOT NULL AND REPLACE(REPLACE(b.pickup_contact_phone, '-', ''), ' ', '') = v_phone)
                    OR (v_name IS NOT NULL AND b.pickup_contact_name IS NOT NULL AND LOWER(TRIM(b.pickup_contact_name)) = v_name)
                    OR (v_nickname IS NOT NULL AND b.pickup_contact_name IS NOT NULL AND LOWER(TRIM(b.pickup_contact_name)) = v_nickname)
                )
            )
        )

        UNION ALL

        SELECT 
            jsonb_build_object(
                'id', 'arcade_' || al.id,
                'created_at', al.created_at,
                'booking_time', al.created_at,
                'booking_type', 'arcade',
                'status', 'completed',
                'total_amount', 0,
                'xhaus_earned', COALESCE(al.xhaus_rewarded, 0),
                'xhaus_redeemed', 0,
                'xhaus_discount', 0,
                'table_name', 'ARCADE',
                'source', 'arcade',
                'reward_type', al.reward_type,
                'order_items', '[]'::jsonb
            ) AS h
        FROM public.arcade_rewards_log al
        WHERE al.profile_id = p_user_id AND COALESCE(al.xhaus_rewarded, 0) > 0
    ) sub;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- SECTION 6. ATOMIC CHECKOUT & REWARD LIMIT MANAGEMENT
-- ============================================================================
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
    res_user_id UUID,
    new_balance NUMERIC(10, 2)
) AS $$
DECLARE
    v_user_id UUID;
    v_new_balance NUMERIC(10, 2) := 0.00;
    v_calculated_tier TEXT;
BEGIN
    IF p_user_id IS NOT NULL THEN
        v_user_id := p_user_id;
    ELSE
        SELECT b.user_id INTO v_user_id FROM public.bookings b WHERE b.id = p_booking_id;
    END IF;

    UPDATE public.bookings AS bk
    SET xhaus_earned = COALESCE(p_xhaus_earned, 0.00),
        xhaus_redeemed = COALESCE(p_xhaus_redeemed, 0.00),
        xhaus_discount = COALESCE(p_xhaus_discount, 0.00),
        user_id = COALESCE(v_user_id, bk.user_id),
        status = 'completed'
    WHERE bk.id = p_booking_id;

    IF v_user_id IS NOT NULL THEN
        UPDATE public.profiles AS pr
        SET xhaus_balance = GREATEST(0.00, COALESCE(pr.xhaus_balance, 0.00) + COALESCE(p_xhaus_earned, 0.00) - COALESCE(p_xhaus_redeemed, 0.00)),
            total_earned_xhaus = COALESCE(pr.total_earned_xhaus, 0.00) + COALESCE(p_xhaus_earned, 0.00),
            total_redeemed_xhaus = COALESCE(pr.total_redeemed_xhaus, 0.00) + COALESCE(p_xhaus_redeemed, 0.00)
        WHERE pr.id = v_user_id
        RETURNING pr.xhaus_balance INTO v_new_balance;

        SELECT t.current_tier INTO v_calculated_tier 
        FROM public.get_member_tier_details(v_user_id) t;

        IF v_calculated_tier IS NOT NULL THEN
            UPDATE public.profiles AS pr
            SET current_tier = v_calculated_tier
            WHERE pr.id = v_user_id AND (pr.current_tier IS DISTINCT FROM v_calculated_tier);
        END IF;
    END IF;

    RETURN QUERY SELECT true, v_user_id, v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reward Usage Quota Trigger Function
CREATE OR REPLACE FUNCTION public.handle_reward_usage()
RETURNS TRIGGER AS $$
DECLARE
    v_reward RECORD;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'completed' AND NEW.xhaus_reward_id IS NOT NULL) OR
       (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND NEW.xhaus_reward_id IS NOT NULL and (OLD.status IS NULL OR OLD.status <> 'completed')) THEN
        
        SELECT * INTO v_reward 
        FROM public.xhaus_rewards 
        WHERE id = NEW.xhaus_reward_id 
        FOR UPDATE;

        IF FOUND THEN
            IF v_reward.is_active AND (v_reward.usage_limit IS NULL OR v_reward.used_count < v_reward.usage_limit) THEN
                UPDATE public.xhaus_rewards 
                SET used_count = used_count + 1 
                WHERE id = v_reward.id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_apply_reward ON public.bookings;
CREATE TRIGGER trigger_apply_reward
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.handle_reward_usage();

-- ============================================================================
-- SECTION 7. DRINK STAMPS & BEVERAGE ELIGIBILITY (10 FREE 1)
-- ============================================================================
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
   OR LOWER(name) LIKE '%shot%'
   OR LOWER(name) LIKE '%ชา%'
   OR LOWER(name) LIKE '%กาแฟ%'
   OR LOWER(name) LIKE '%เครื่องดื่ม%'
   OR LOWER(name) LIKE '%นมสด%'
   OR LOWER(name) LIKE '%มัทฉะ%'
   OR LOWER(name) LIKE '%โกโก้%'
   OR LOWER(name) LIKE '%น้ำผลไม้%'
   OR LOWER(name) LIKE '%โซดา%'
   OR LOWER(name) LIKE '%ช็อต%'
   OR LOWER(name) LIKE '%เอสเพรสโซ%';

UPDATE public.menu_items mi
SET is_drink_stamp_eligible = true
FROM public.menu_categories mc
WHERE mi.category_id = mc.id AND mc.is_drink_stamp_eligible = true;

UPDATE public.menu_items
SET is_drink_stamp_eligible = true
WHERE LOWER(name) LIKE '%espresso%'
   OR LOWER(name) LIKE '%shot%'
   OR LOWER(name) LIKE '%coffee%'
   OR LOWER(name) LIKE '%tea%'
   OR LOWER(name) LIKE '%latte%'
   OR LOWER(name) LIKE '%matcha%'
   OR LOWER(name) LIKE '%กาแฟ%'
   OR LOWER(name) LIKE '%ชา%'
   OR LOWER(name) LIKE '%ช็อต%'
   OR LOWER(name) LIKE '%เอสเพรสโซ%';

-- ============================================================================
-- SECTION 8. ARCADE REWARDS & WEEKLY RAFFLE FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.claim_arcade_rewards(p_score INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_user_id uuid;
    v_today_start TIMESTAMP WITH TIME ZONE;
    v_week_start TIMESTAMP WITH TIME ZONE;
    
    v_has_20 BOOLEAN := false;
    v_has_35 BOOLEAN := false;
    v_has_raffle BOOLEAN := false;
    
    v_weekly_xhaus NUMERIC(10, 2) := 0.00;
    v_earned_xhaus NUMERIC(10, 2) := 0.00;
    v_earned_raffle BOOLEAN := false;
    v_msg TEXT := '';
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    v_today_start := timezone('Asia/Bangkok', CURRENT_DATE::timestamp);
    v_week_start := date_trunc('week', now() AT TIME ZONE 'Asia/Bangkok');

    SELECT EXISTS (
        SELECT 1 FROM public.arcade_rewards_log 
        WHERE profile_id = v_user_id AND reward_type = 'pipe_20' AND created_at >= v_today_start
    ) INTO v_has_20;

    SELECT EXISTS (
        SELECT 1 FROM public.arcade_rewards_log 
        WHERE profile_id = v_user_id AND reward_type = 'pipe_35' AND created_at >= v_today_start
    ) INTO v_has_35;

    SELECT EXISTS (
        SELECT 1 FROM public.arcade_rewards_log 
        WHERE profile_id = v_user_id AND reward_type = 'raffle_40' AND created_at >= v_today_start
    ) INTO v_has_raffle;

    SELECT COALESCE(SUM(xhaus_rewarded), 0.00)
    INTO v_weekly_xhaus
    FROM public.arcade_rewards_log
    WHERE profile_id = v_user_id 
      AND reward_type IN ('pipe_20', 'pipe_35') 
      AND created_at >= v_week_start;

    IF p_score >= 20 AND NOT v_has_20 THEN
        IF v_weekly_xhaus + v_earned_xhaus < 5.00 THEN
            v_earned_xhaus := v_earned_xhaus + 1.00;
            INSERT INTO public.arcade_rewards_log (profile_id, score, xhaus_rewarded, reward_type)
            VALUES (v_user_id, p_score, 1.00, 'pipe_20');
        ELSE
            v_msg := v_msg || 'โควตาเหรียญสัปดาห์นี้เต็มแล้ว (ได้สูงสุด 5 xhaus); ';
        END IF;
    END IF;

    IF p_score >= 35 AND NOT v_has_35 THEN
        IF v_weekly_xhaus + v_earned_xhaus < 5.00 THEN
            v_earned_xhaus := v_earned_xhaus + 1.00;
            INSERT INTO public.arcade_rewards_log (profile_id, score, xhaus_rewarded, reward_type)
            VALUES (v_user_id, p_score, 1.00, 'pipe_35');
        ELSE
            IF v_msg = '' OR v_msg NOT LIKE '%โควตาเหรียญสัปดาห์นี้เต็มแล้ว%' THEN
                v_msg := v_msg || 'โควตาเหรียญสัปดาห์นี้เต็มแล้ว; ';
            END IF;
        END IF;
    END IF;

    IF p_score >= 40 AND NOT v_has_raffle THEN
        v_earned_raffle := true;
        INSERT INTO public.arcade_rewards_log (profile_id, score, xhaus_rewarded, reward_type, has_raffle_ticket)
        VALUES (v_user_id, p_score, 0.00, 'raffle_40', true);
    END IF;

    IF v_earned_xhaus > 0.00 THEN
        UPDATE public.profiles
        SET xhaus_balance = COALESCE(xhaus_balance, 0.00) + v_earned_xhaus,
            total_earned_xhaus = COALESCE(total_earned_xhaus, 0.00) + v_earned_xhaus
        WHERE id = v_user_id;
    END IF;

    IF v_earned_xhaus > 0.00 OR v_earned_raffle THEN
        v_msg := 'สะสมสิทธิ์สำเร็จ! ';
        IF v_earned_xhaus > 0.00 THEN
            v_msg := v_msg || 'ได้รับ ' || v_earned_xhaus::TEXT || ' xhaus; ';
        END IF;
        IF v_earned_raffle THEN
            v_msg := v_msg || 'ได้รับตั๋วสุ่มจับรางวัลลุ้นโชค 1 ใบ; ';
        END IF;
    ELSE
        v_msg := v_msg || 'คุณได้รับเหรียญและตั๋วของเกณฑ์นี้ไปแล้วในวันนี้';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'earned_xhaus', v_earned_xhaus,
        'earned_raffle', v_earned_raffle,
        'weekly_total', v_weekly_xhaus + v_earned_xhaus,
        'message', v_msg
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.draw_weekly_arcade_raffle_and_reset()
RETURNS JSONB AS $$
DECLARE
    v_top_player_id UUID;
    v_top_player_name TEXT;
    v_top_score INTEGER;
    
    v_raffle_winner_id UUID;
    v_raffle_winner_name TEXT;
    v_raffle_tickets_count INTEGER;
    
    v_week_start TIMESTAMP WITH TIME ZONE;
BEGIN
    v_week_start := date_trunc('week', now() AT TIME ZONE 'Asia/Bangkok');

    SELECT profile_id, display_name, score
    INTO v_top_player_id, v_top_player_name, v_top_score
    FROM public.leaderboard
    ORDER BY score DESC, created_at ASC
    LIMIT 1;

    IF v_top_player_id IS NOT NULL THEN
        INSERT INTO public.arcade_rewards_log (profile_id, score, xhaus_rewarded, reward_type)
        VALUES (v_top_player_id, v_top_score, 50.00, 'weekly_top_1');

        UPDATE public.profiles
        SET xhaus_balance = COALESCE(xhaus_balance, 0.00) + 50.00,
            total_earned_xhaus = COALESCE(total_earned_xhaus, 0.00) + 50.00
        WHERE id = v_top_player_id;
    END IF;

    SELECT COUNT(DISTINCT profile_id)
    INTO v_raffle_tickets_count
    FROM public.arcade_rewards_log
    WHERE reward_type = 'raffle_40' AND created_at >= v_week_start;

    IF v_raffle_tickets_count > 0 THEN
        SELECT profile_id INTO v_raffle_winner_id
        FROM public.arcade_rewards_log
        WHERE reward_type = 'raffle_40' AND created_at >= v_week_start
        ORDER BY random()
        LIMIT 1;

        IF v_raffle_winner_id IS NOT NULL THEN
            SELECT COALESCE(nickname, display_name) INTO v_raffle_winner_name
            FROM public.profiles
            WHERE id = v_raffle_winner_id;

            INSERT INTO public.arcade_rewards_log (profile_id, score, xhaus_rewarded, reward_type)
            VALUES (v_raffle_winner_id, 40, 50.00, 'raffle_draw_50');

            UPDATE public.profiles
            SET xhaus_balance = COALESCE(xhaus_balance, 0.00) + 50.00,
                total_earned_xhaus = COALESCE(total_earned_xhaus, 0.00) + 50.00
            WHERE id = v_raffle_winner_id;
        END IF;
    END IF;

    DELETE FROM public.leaderboard;

    RETURN jsonb_build_object(
        'success', true,
        'top_player', jsonb_build_object('name', COALESCE(v_top_player_name, '-'), 'score', COALESCE(v_top_score, 0)),
        'raffle_winner', jsonb_build_object('name', COALESCE(v_raffle_winner_name, '-'), 'tickets_checked', v_raffle_tickets_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 9. HIGH PERFORMANCE STOCK MANAGEMENT TRIGGERS & RPCS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_stock_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_type IN ('set', 'audit') THEN
        RETURN NEW;
    END IF;

    UPDATE public.stock_items
    SET current_quantity = current_quantity + NEW.quantity_change,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.stock_item_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_stock_transaction_sync ON public.stock_transactions;
DROP TRIGGER IF EXISTS trg_stock_transaction_sync_v2 ON public.stock_transactions;
DROP TRIGGER IF EXISTS stock_transaction_trigger ON public.stock_transactions;
DROP TRIGGER IF EXISTS handle_stock_transaction_trigger ON public.stock_transactions;

CREATE TRIGGER trg_stock_transaction_sync
AFTER INSERT ON public.stock_transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_transaction();

CREATE OR REPLACE FUNCTION public.set_stock_quantity(
    p_item_id UUID,
    p_new_quantity FLOAT,
    p_reason TEXT DEFAULT 'Audit',
    p_performed_by TEXT DEFAULT 'Staff'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_quantity FLOAT;
    v_diff FLOAT;
BEGIN
    SELECT current_quantity INTO v_old_quantity
    FROM public.stock_items
    WHERE id = p_item_id
    FOR UPDATE;

    v_diff := p_new_quantity - COALESCE(v_old_quantity, 0);

    UPDATE public.stock_items
    SET current_quantity = p_new_quantity,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_item_id;

    INSERT INTO public.stock_transactions (stock_item_id, transaction_type, quantity_change, performed_by, note)
    VALUES (p_item_id, 'set', v_diff, p_performed_by, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_stock_quantity(
    p_item_id UUID,
    p_quantity_change FLOAT,
    p_performed_by TEXT DEFAULT 'Staff',
    p_note TEXT DEFAULT 'Adjustment'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.stock_transactions (stock_item_id, transaction_type, quantity_change, performed_by, note)
    VALUES (p_item_id, CASE WHEN p_quantity_change >= 0 THEN 'in' ELSE 'out' END, p_quantity_change, p_performed_by, p_note);
END;
$$;

CREATE OR REPLACE FUNCTION public.find_profile_by_name(p_name TEXT)
RETURNS TABLE (id UUID, display_name TEXT, nickname TEXT, phone_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.display_name, p.nickname, p.phone_number
    FROM public.profiles p
    WHERE p.display_name ILIKE '%' || p_name || '%'
       OR p.nickname ILIKE '%' || p_name || '%';
END;
$$;
