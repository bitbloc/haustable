-- Migration: Auto-Link Member Orders & High-Performance Member History RPC
-- Date: 2026-08-13
-- Description: Automatically links historical & future orders (POS/Online) to member profiles by phone number or name, and provides a SECURITY DEFINER RPC function for Member History.

-- 1. Function to auto-link a booking to a member profile
CREATE OR REPLACE FUNCTION public.auto_link_booking_member()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_id UUID := NULL;
    v_phone TEXT;
    v_name TEXT;
BEGIN
    -- If user_id is already set, no action needed
    IF NEW.user_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Normalize contact phone
    v_phone := NULLIF(REPLACE(REPLACE(COALESCE(NEW.pickup_contact_phone, ''), '-', ''), ' ', ''), '');
    v_name := NULLIF(LOWER(TRIM(COALESCE(NEW.pickup_contact_name, ''))), '');

    -- Try matching profile by phone number first
    IF v_phone IS NOT NULL THEN
        SELECT id INTO v_profile_id
        FROM public.profiles
        WHERE phone_number IS NOT NULL
          AND REPLACE(REPLACE(phone_number, '-', ''), ' ', '') = v_phone
        LIMIT 1;
    END IF;

    -- Try matching profile by display_name or nickname if phone match not found
    IF v_profile_id IS NULL AND v_name IS NOT NULL AND LENGTH(v_name) >= 2 THEN
        SELECT id INTO v_profile_id
        FROM public.profiles
        WHERE LOWER(TRIM(display_name)) = v_name
           OR LOWER(TRIM(nickname)) = v_name
        LIMIT 1;
    END IF;

    -- If profile match found, auto-link user_id
    IF v_profile_id IS NOT NULL THEN
        NEW.user_id := v_profile_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger to auto-link on booking INSERT or UPDATE
DROP TRIGGER IF EXISTS trg_auto_link_booking_member ON public.bookings;
CREATE TRIGGER trg_auto_link_booking_member
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_booking_member();

-- 3. Bulk auto-link all historical bookings in the database right now
UPDATE public.bookings b
SET user_id = p.id
FROM public.profiles p
WHERE b.user_id IS NULL
  AND (
    (b.pickup_contact_phone IS NOT NULL AND REPLACE(REPLACE(b.pickup_contact_phone, '-', ''), ' ', '') = REPLACE(REPLACE(p.phone_number, '-', ''), ' ', ''))
    OR (b.pickup_contact_name IS NOT NULL AND LOWER(TRIM(b.pickup_contact_name)) = LOWER(TRIM(p.display_name)))
    OR (p.nickname IS NOT NULL AND p.nickname != '' AND LOWER(TRIM(COALESCE(b.pickup_contact_name, ''))) = LOWER(TRIM(p.nickname)))
  );

-- 4. High-Performance RPC function for Member History (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.get_member_service_history(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_phone TEXT;
    v_name TEXT;
    v_prof_created TIMESTAMPTZ;
    v_total_earned NUMERIC(10,2) := 0.00;
    v_balance NUMERIC(10,2) := 0.00;
    v_result JSONB;
BEGIN
    -- Get user profile details
    SELECT phone_number, display_name, created_at, COALESCE(total_earned_xhaus, 0.00), COALESCE(xhaus_balance, 0.00)
    INTO v_phone, v_name, v_prof_created, v_total_earned, v_balance
    FROM public.profiles
    WHERE id = p_user_id;

    v_phone := NULLIF(REPLACE(REPLACE(COALESCE(v_phone, ''), '-', ''), ' ', ''), '');
    v_name := NULLIF(LOWER(TRIM(COALESCE(v_name, ''))), '');

    -- Ensure any unlinked bookings for this user are linked right now
    UPDATE public.bookings b
    SET user_id = p_user_id
    WHERE b.user_id IS NULL
      AND (
        (v_phone IS NOT NULL AND b.pickup_contact_phone IS NOT NULL AND REPLACE(REPLACE(b.pickup_contact_phone, '-', ''), ' ', '') = v_phone)
        OR (v_name IS NOT NULL AND LOWER(TRIM(COALESCE(b.pickup_contact_name, ''))) = v_name)
      );

    -- Build clean combined JSON array of history
    SELECT COALESCE(jsonb_agg(h ORDER BY (h->>'created_at') DESC), '[]'::jsonb)
    INTO v_result
    FROM (
        -- A. Bookings History
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
        WHERE b.user_id = p_user_id

        UNION ALL

        -- B. Arcade Rewards History
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
