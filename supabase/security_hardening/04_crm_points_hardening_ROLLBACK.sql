-- ROLLBACK for supabase/migrations/20261117000000_crm_points_hardening.sql
-- Removes the profile guard triggers and the refund function, and puts
-- process_checkout_xhaus and draw_weekly_arcade_raffle_and_reset back to the definitions
-- that were live on 2026-11-16. The xhaus_checkout_log table is left in place (harmless,
-- and it keeps the record of what was paid out).
-- The app falls back to its old client-side refund when refund_booking_loyalty is missing.
BEGIN;

DROP TRIGGER IF EXISTS guard_profile_privileged_columns_ins ON public.profiles;
DROP TRIGGER IF EXISTS guard_profile_privileged_columns_upd ON public.profiles;
DROP FUNCTION IF EXISTS public.guard_profile_privileged_columns();
DROP FUNCTION IF EXISTS public.refund_booking_loyalty(UUID);

CREATE OR REPLACE FUNCTION public.process_checkout_xhaus(p_booking_id uuid, p_xhaus_earned numeric, p_xhaus_redeemed numeric, p_xhaus_discount numeric, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(success boolean, res_user_id uuid, new_balance numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
        user_id = COALESCE(bk.user_id, v_user_id),
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
$function$;

CREATE OR REPLACE FUNCTION public.draw_weekly_arcade_raffle_and_reset()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_top1_user UUID;
    v_top1_score INTEGER;
    v_top1_name TEXT;
    v_raffle_winner_user UUID;
    v_raffle_winner_name TEXT;
    v_week_start TIMESTAMPTZ;
    v_month_start TIMESTAMPTZ;
BEGIN
    v_week_start  := date_trunc('week', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok';
    v_month_start := date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok';

    -- 1. Find Top 1 Player on current month's Leaderboard (with a valid member profile_id)
    SELECT profile_id, score, display_name
    INTO v_top1_user, v_top1_score, v_top1_name
    FROM public.leaderboard
    WHERE profile_id IS NOT NULL
      AND created_at >= v_month_start
    ORDER BY score DESC, created_at ASC
    LIMIT 1;

    IF v_top1_user IS NOT NULL THEN
        UPDATE public.profiles
        SET xhaus_balance = COALESCE(xhaus_balance, 0.00) + 50.00
        WHERE id = v_top1_user;

        INSERT INTO public.arcade_rewards_log (profile_id, reward_type, score, xhaus_rewarded)
        VALUES (v_top1_user, 'weekly_top1', v_top1_score, 50.00);
    END IF;

    -- 2. Draw 1 Random Winner from this week's 'raffle_40' tickets
    SELECT r.profile_id, COALESCE(p.nickname, p.display_name, 'Lucky Winner')
    INTO v_raffle_winner_user, v_raffle_winner_name
    FROM public.arcade_rewards_log r
    LEFT JOIN public.profiles p ON p.id = r.profile_id
    WHERE r.reward_type = 'raffle_40'
      AND r.created_at >= v_week_start
    ORDER BY random()
    LIMIT 1;

    IF v_raffle_winner_user IS NOT NULL THEN
        UPDATE public.profiles
        SET xhaus_balance = COALESCE(xhaus_balance, 0.00) + 50.00
        WHERE id = v_raffle_winner_user;

        INSERT INTO public.arcade_rewards_log (profile_id, reward_type, score, xhaus_rewarded)
        VALUES (v_raffle_winner_user, 'weekly_raffle_win', 40, 50.00);
    END IF;

    -- 3. Clear the Leaderboard for the fresh cycle
    DELETE FROM public.leaderboard WHERE true;

    RETURN jsonb_build_object(
        'success', true,
        'top1_winner', v_top1_name,
        'top1_score', v_top1_score,
        'raffle_winner', v_raffle_winner_name
    );
END;
$function$;

COMMIT;
