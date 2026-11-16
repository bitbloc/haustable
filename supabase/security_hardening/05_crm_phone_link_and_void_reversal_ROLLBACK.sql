-- ROLLBACK for supabase/migrations/20261117010000_crm_phone_link_and_void_reversal.sql
-- Puts name/nickname linking back (the four functions as they were live on 2026-11-16),
-- removes the void reversal trigger and restores process_checkout_xhaus from
-- 20261117000000. The three reversed_* columns are left in place (harmless).
BEGIN;

DROP TRIGGER IF EXISTS trg_reverse_xhaus_on_void ON public.bookings;
DROP FUNCTION IF EXISTS public.reverse_xhaus_on_void();

CREATE OR REPLACE FUNCTION public.auto_link_booking_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.auto_link_profile_bookings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_member_tier_details(p_user_id uuid)
 RETURNS TABLE(accumulated_spent_12m numeric, accumulated_spent_13m numeric, current_tier text, multiplier numeric, discount_rate numeric, is_in_grace_period boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_member_service_history(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.process_checkout_xhaus(
    p_booking_id UUID,
    p_xhaus_earned NUMERIC,
    p_xhaus_redeemed NUMERIC,
    p_xhaus_discount NUMERIC,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, res_user_id UUID, new_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking_user UUID;
    v_total NUMERIC := 0;
    v_user_id UUID;
    v_requested NUMERIC := GREATEST(0, COALESCE(p_xhaus_earned, 0));
    v_earned NUMERIC;
    v_redeemed NUMERIC := GREATEST(0, COALESCE(p_xhaus_redeemed, 0));
    v_discount NUMERIC := GREATEST(0, COALESCE(p_xhaus_discount, 0));
    v_base NUMERIC := 100;
    v_mult NUMERIC := 1.00;
    v_cap NUMERIC;
    v_new_balance NUMERIC(10, 2) := 0.00;
    v_calculated_tier TEXT;
BEGIN
    -- Lock the bill so two calls for the same bill cannot both pay out
    SELECT b.user_id, COALESCE(b.total_amount, 0)
    INTO v_booking_user, v_total
    FROM public.bookings b
    WHERE b.id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, 0.00::NUMERIC;
        RETURN;
    END IF;

    v_user_id := COALESCE(p_user_id, v_booking_user);

    -- Already paid out for this bill: report the current balance and change nothing
    IF EXISTS (SELECT 1 FROM public.xhaus_checkout_log l WHERE l.booking_id = p_booking_id) THEN
        SELECT COALESCE(pr.xhaus_balance, 0.00) INTO v_new_balance
        FROM public.profiles pr WHERE pr.id = v_user_id;
        RETURN QUERY SELECT true, v_user_id, COALESCE(v_new_balance, 0.00)::NUMERIC;
        RETURN;
    END IF;

    UPDATE public.bookings AS bk
    SET user_id = COALESCE(bk.user_id, v_user_id),
        status = 'completed'
    WHERE bk.id = p_booking_id;

    -- Ceiling: bill total / baht-per-coin x the member's tier multiplier
    BEGIN
        SELECT COALESCE(NULLIF(TRIM(value), '')::NUMERIC, 100) INTO v_base
        FROM public.app_settings WHERE key = 'crm_base_spend_amount';
    EXCEPTION WHEN OTHERS THEN
        v_base := 100;
    END;
    IF v_base IS NULL OR v_base <= 0 THEN
        v_base := 100;
    END IF;

    IF v_user_id IS NOT NULL THEN
        SELECT t.multiplier, t.current_tier INTO v_mult, v_calculated_tier
        FROM public.get_member_tier_details(v_user_id) t;
    END IF;

    v_cap := FLOOR(GREATEST(0, v_total) / v_base * COALESCE(v_mult, 1.00) * 100) / 100 + 0.01;
    v_earned := LEAST(v_requested, v_cap);

    UPDATE public.bookings AS bk
    SET xhaus_earned = v_earned,
        xhaus_redeemed = v_redeemed,
        xhaus_discount = v_discount
    WHERE bk.id = p_booking_id;

    INSERT INTO public.xhaus_checkout_log (booking_id, user_id, xhaus_earned, xhaus_redeemed, xhaus_discount, requested_earned)
    VALUES (p_booking_id, v_user_id, v_earned, v_redeemed, v_discount, v_requested);

    IF v_user_id IS NOT NULL THEN
        UPDATE public.profiles AS pr
        SET xhaus_balance = GREATEST(0.00, COALESCE(pr.xhaus_balance, 0.00) + v_earned - v_redeemed),
            total_earned_xhaus = COALESCE(pr.total_earned_xhaus, 0.00) + v_earned,
            total_redeemed_xhaus = COALESCE(pr.total_redeemed_xhaus, 0.00) + v_redeemed
        WHERE pr.id = v_user_id
        RETURNING pr.xhaus_balance INTO v_new_balance;

        IF v_calculated_tier IS NOT NULL THEN
            UPDATE public.profiles AS pr
            SET current_tier = v_calculated_tier
            WHERE pr.id = v_user_id AND (pr.current_tier IS DISTINCT FROM v_calculated_tier);
        END IF;
    END IF;

    RETURN QUERY SELECT true, v_user_id, COALESCE(v_new_balance, 0.00)::NUMERIC;
END;
$$;

COMMIT;
