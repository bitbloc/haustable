-- Migration: Dynamic CRM Tiers & Granular Coin Settings
-- Date: 2026-08-18
-- Description: Adds granular CRM app_settings and enhances get_member_tier_details to evaluate dynamic relationship tiers from JSON configuration.

-- 1. Insert default settings for granular coin calculation and dynamic tiers
INSERT INTO public.app_settings (key, value) VALUES
('crm_welcome_xhaus', '10.00'),
('crm_redeem_rate_xhaus', '1.00'),
('crm_min_redeem_xhaus', '10.00'),
('crm_base_spend_amount', '100.00'),
('crm_max_redeem_percent', '100'),
('crm_tier_eval_months', '12'),
('crm_grace_period_days', '30'),
('crm_tiers_config', '[{"id":"tier_common","level_code":"01","name":"Haus Common","min_spend":0,"multiplier":1.00,"tagline":"\"พื้นที่ที่เราเริ่มรู้จักกัน\" — ทุกคนเริ่มต้นจากพื้นที่เดียวกัน","condition_text":"สมัครสมาชิกและมียอดใช้จ่ายสะสม 12 เดือนแรกเริ่ม (0 – 3,999 บาท)","badge_theme":"bronze"},{"id":"tier_people","level_code":"02","name":"Haus People","min_spend":4000,"multiplier":1.25,"tagline":"\"คนที่กลับมาเจอกันบ่อยขึ้น\" — ไม่ได้แค่มาเยือนแต่กลับมาเจอกันเรื่อยๆ","condition_text":"มียอดจ่ายสะสมสุทธิครบ 4,000 บาทภายใน 12 เดือน","badge_theme":"silver"},{"id":"tier_inner","level_code":"03","name":"Inner Haus","min_spend":12000,"multiplier":1.50,"tagline":"\"คนในบ้าน\" — เข้ามาสัมผัสพื้นที่ข้างในบ้านอย่างอบอุ่นแล้ว","condition_text":"มียอดจ่ายสะสมสุทธิครบ 12,000 บาทภายใน 12 เดือน","badge_theme":"gold"}]')
ON CONFLICT (key) DO NOTHING;

-- 2. Enhanced get_member_tier_details RPC supporting dynamic JSON configuration
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
    v_tier TEXT := 'Haus Common';
    v_mult NUMERIC(3, 2) := 1.00;
    v_disc NUMERIC(3, 2) := 0.00;
    v_grace BOOLEAN := false;
    
    v_eval_months INT := 12;
    v_grace_days INT := 30;
    v_tiers_json JSONB;
    v_tier_item JSONB;
    v_min_spend NUMERIC(10, 2);
    v_tier_name TEXT;
    v_tier_mult NUMERIC(3, 2);
    v_found_std BOOLEAN := false;
    v_found_grace BOOLEAN := false;
    v_grace_tier TEXT;
    v_grace_mult NUMERIC(3, 2);
BEGIN
    -- Read evaluation parameters from app_settings
    BEGIN
        SELECT COALESCE(NULLIF(TRIM(value), '')::INT, 12) INTO v_eval_months
        FROM public.app_settings WHERE key = 'crm_tier_eval_months';
    EXCEPTION WHEN OTHERS THEN
        v_eval_months := 12;
    END;

    BEGIN
        SELECT COALESCE(NULLIF(TRIM(value), '')::INT, 30) INTO v_grace_days
        FROM public.app_settings WHERE key = 'crm_grace_period_days';
    EXCEPTION WHEN OTHERS THEN
        v_grace_days := 30;
    END;

    -- Fetch user profile identifiers for cross-linking
    SELECT 
        NULLIF(REPLACE(REPLACE(COALESCE(phone_number, ''), '-', ''), ' ', ''), ''),
        NULLIF(LOWER(TRIM(COALESCE(display_name, ''))), ''),
        NULLIF(LOWER(TRIM(COALESCE(nickname, ''))), '')
    INTO v_phone, v_name, v_nickname
    FROM public.profiles
    WHERE id = p_user_id;

    -- Calculate accumulated spent within standard and grace rolling windows
    SELECT 
        COALESCE(SUM(CASE WHEN b.created_at >= NOW() - (v_eval_months || ' months')::INTERVAL THEN b.total_amount ELSE 0 END), 0.00),
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
    AND b.created_at >= NOW() - ((v_eval_months || ' months')::INTERVAL + (v_grace_days || ' days')::INTERVAL);

    -- Try dynamic evaluation via JSON configuration in app_settings
    BEGIN
        SELECT value::JSONB INTO v_tiers_json 
        FROM public.app_settings 
        WHERE key = 'crm_tiers_config';
    EXCEPTION WHEN OTHERS THEN
        v_tiers_json := NULL;
    END;

    IF v_tiers_json IS NOT NULL AND jsonb_typeof(v_tiers_json) = 'array' AND jsonb_array_length(v_tiers_json) > 0 THEN
        -- Evaluate standard period (Top-down by min_spend DESC)
        FOR v_tier_item IN 
            SELECT value 
            FROM jsonb_array_elements(v_tiers_json) 
            ORDER BY COALESCE((value->>'min_spend')::NUMERIC, 0) DESC
        LOOP
            v_min_spend := COALESCE((v_tier_item->>'min_spend')::NUMERIC, 0);
            v_tier_name := COALESCE(v_tier_item->>'name', 'Haus Common');
            v_tier_mult := COALESCE((v_tier_item->>'multiplier')::NUMERIC, 1.00);

            IF NOT v_found_std AND v_spent_12m >= v_min_spend THEN
                v_tier := v_tier_name;
                v_mult := v_tier_mult;
                v_found_std := true;
            END IF;

            IF NOT v_found_grace AND v_spent_13m >= v_min_spend THEN
                v_grace_tier := v_tier_name;
                v_grace_mult := v_tier_mult;
                v_found_grace := true;
            END IF;
        END LOOP;

        -- If grace period qualifies for higher tier than standard
        IF v_found_grace AND (NOT v_found_std OR v_grace_mult > v_mult) THEN
            v_tier := v_grace_tier;
            v_mult := v_grace_mult;
            v_grace := true;
        END IF;

    ELSE
        -- Fallback to hardcoded standard rules if JSON config is absent
        IF v_spent_12m >= 12000.00 THEN
            v_tier := 'Inner Haus';
            v_mult := 1.50;
        ELSIF v_spent_13m >= 12000.00 THEN
            v_tier := 'Inner Haus';
            v_mult := 1.50;
            v_grace := true;
        ELSIF v_spent_12m >= 4000.00 THEN
            v_tier := 'Haus People';
            v_mult := 1.25;
        ELSIF v_spent_13m >= 4000.00 THEN
            v_tier := 'Haus People';
            v_mult := 1.25;
            v_grace := true;
        ELSE
            v_tier := 'Haus Common';
            v_mult := 1.00;
        END IF;
    END IF;

    RETURN QUERY SELECT v_spent_12m, v_spent_13m, v_tier, v_mult, v_disc, v_grace;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
