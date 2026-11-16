-- ==============================================================================
-- CRM points hardening (xhaus coins, tiers, roles)
--
-- APPLIED to production on 2026-11-16 (owner approved), with no bill open at the time, via
--   npx supabase db query --remote --yes -f supabase/migrations/20261117000000_crm_points_hardening.sql
-- after a rolled-back dry run of the same file passed its checks. Verified right after:
-- both guard triggers present, 1,925 closed bills all in xhaus_checkout_log, total coin
-- balance unchanged (1,478.6).
-- Rollback: supabase/security_hardening/04_crm_points_hardening_ROLLBACK.sql
--
-- What it closes
--   A. A logged-in member could UPDATE (or INSERT) their own profiles row with any column:
--      role = 'admin', admin_permissions, pin, xhaus_balance, free drinks. Now a direct
--      write by a non-admin can only lower their own coins/stamps (the online checkout
--      still deducts that way) and can never touch role, permissions, pin or tier.
--   B. process_checkout_xhaus could be replayed on the same bill and accepted any number
--      of coins. Now it pays out once per bill (xhaus_checkout_log) and never more than
--      bill total / crm_base_spend_amount x the member's tier multiplier.
--   C. draw_weekly_arcade_raffle_and_reset (2 x 50 coins + leaderboard wipe) was callable
--      by anyone. Now back-office owner/admin only.
--   D. Refunding coins on a cancelled online order needed a profile write the POS is not
--      allowed to do, so it silently did nothing. refund_booking_loyalty() does it in the
--      database, once per booking.
--
-- What it deliberately does NOT close (needs the POS to sign in as a device, stage 4)
--   profiles and bookings stay readable/writable by the public key, and
--   process_checkout_xhaus / process_drink_stamps stay callable without a login, because
--   the PIN-only POS calls them. B and D are therefore bounded, not sealed.
--
-- How the guard tells callers apart: inside a SECURITY DEFINER function current_user is
-- the function owner (postgres); a direct API write runs as 'authenticated' or 'anon'.
-- Edge functions use service_role. So only direct API writes are restricted.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- A. profiles: guard privileged columns against direct writes by non-admins
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_spent NUMERIC;
BEGIN
    -- Not SECURITY DEFINER on purpose: current_user must be the real caller.
    IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- A self-created profile always starts as a plain customer with nothing on it.
        -- (grant_welcome_xhaus runs after this trigger and adds the welcome coins.)
        NEW.role := 'customer';
        NEW.admin_permissions := '{}'::text[];
        NEW.pin := NULL;
        NEW.current_tier := 'Haus Common';
        NEW.xhaus_balance := 0.00;
        NEW.total_earned_xhaus := 0.00;
        NEW.total_redeemed_xhaus := 0.00;
        NEW.drink_stamp_count := 0;
        NEW.free_drink_quota := 0;
        NEW.total_drinks_purchased := 0;
        RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.admin_permissions IS DISTINCT FROM OLD.admin_permissions
       OR NEW.pin IS DISTINCT FROM OLD.pin
       OR NEW.current_tier IS DISTINCT FROM OLD.current_tier
       OR NEW.total_earned_xhaus IS DISTINCT FROM OLD.total_earned_xhaus
       OR NEW.total_drinks_purchased IS DISTINCT FROM OLD.total_drinks_purchased THEN
        RAISE EXCEPTION 'profiles: role, permissions, pin, tier and earned totals cannot be changed from the app'
            USING ERRCODE = '42501';
    END IF;

    IF COALESCE(NEW.xhaus_balance, 0) > COALESCE(OLD.xhaus_balance, 0)
       OR COALESCE(NEW.free_drink_quota, 0) > COALESCE(OLD.free_drink_quota, 0)
       OR COALESCE(NEW.drink_stamp_count, 0) > COALESCE(OLD.drink_stamp_count, 0) THEN
        RAISE EXCEPTION 'profiles: coins, stamps and free drinks cannot be increased from the app'
            USING ERRCODE = '42501';
    END IF;

    -- "Redeemed" may only grow by what was actually taken off the balance in this write.
    v_spent := COALESCE(OLD.xhaus_balance, 0) - COALESCE(NEW.xhaus_balance, 0);
    IF COALESCE(NEW.total_redeemed_xhaus, 0) < COALESCE(OLD.total_redeemed_xhaus, 0)
       OR COALESCE(NEW.total_redeemed_xhaus, 0) > COALESCE(OLD.total_redeemed_xhaus, 0) + v_spent THEN
        RAISE EXCEPTION 'profiles: redeemed total does not match the coins deducted'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger names sort before on_profile_created_welcome_xhaus, so the guard runs first.
DROP TRIGGER IF EXISTS guard_profile_privileged_columns_ins ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns_ins
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

DROP TRIGGER IF EXISTS guard_profile_privileged_columns_upd ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns_upd
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- ------------------------------------------------------------------------------
-- B. process_checkout_xhaus: once per bill, with a ceiling on coins earned
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.xhaus_checkout_log (
    booking_id        UUID PRIMARY KEY,
    user_id           UUID,
    xhaus_earned      NUMERIC(10, 2) NOT NULL DEFAULT 0,
    xhaus_redeemed    NUMERIC(10, 2) NOT NULL DEFAULT 0,
    xhaus_discount    NUMERIC(10, 2) NOT NULL DEFAULT 0,
    requested_earned  NUMERIC(10, 2),
    source            TEXT NOT NULL DEFAULT 'checkout',
    processed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.xhaus_checkout_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xhaus_checkout_log FROM anon, authenticated;
GRANT SELECT ON public.xhaus_checkout_log TO authenticated;
DROP POLICY IF EXISTS "Admins read xhaus_checkout_log" ON public.xhaus_checkout_log;
CREATE POLICY "Admins read xhaus_checkout_log" ON public.xhaus_checkout_log
    FOR SELECT TO authenticated USING (public.is_admin());

-- Every bill that is already closed counts as paid out, so old bills cannot be replayed.
INSERT INTO public.xhaus_checkout_log (booking_id, user_id, xhaus_earned, xhaus_redeemed, xhaus_discount, source, processed_at)
SELECT b.id, b.user_id, COALESCE(b.xhaus_earned, 0), COALESCE(b.xhaus_redeemed, 0), COALESCE(b.xhaus_discount, 0),
       'backfill', COALESCE(b.updated_at, b.created_at, now())
FROM public.bookings b
WHERE b.status IN ('completed', 'void', 'cancelled')
ON CONFLICT (booking_id) DO NOTHING;

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

-- ------------------------------------------------------------------------------
-- C. Weekly arcade draw: back-office owner/admin only
--    (a scheduled job or the SQL editor has no API role and is still allowed)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.draw_weekly_arcade_raffle_and_reset()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_top1_user UUID;
    v_top1_score INTEGER;
    v_top1_name TEXT;
    v_raffle_winner_user UUID;
    v_raffle_winner_name TEXT;
    v_week_start TIMESTAMPTZ;
    v_month_start TIMESTAMPTZ;
BEGIN
    IF COALESCE(auth.jwt() ->> 'role', '') IN ('anon', 'authenticated') AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only an owner or admin can run the weekly draw' USING ERRCODE = '42501';
    END IF;

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
$$;

-- ------------------------------------------------------------------------------
-- D. Refund coins / free drink of a cancelled online order, once per booking
--    Mirrors refundBookingLoyaltyIfNeeded in src/utils/availabilityUtils.js.
--    The coin refund is capped at what the member has actually redeemed in total, so
--    a made-up booking cannot create coins.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_booking_loyalty(p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_status TEXT;
    v_remark TEXT;
    v_note TEXT;
    v_redeemed NUMERIC := 0;
    v_free_drink BOOLEAN := false;
    v_total_redeemed NUMERIC := 0;
BEGIN
    SELECT b.user_id, b.status, COALESCE(b.staff_remark, ''), COALESCE(b.customer_note, ''), COALESCE(b.xhaus_redeemed, 0)
    INTO v_user_id, v_status, v_remark, v_note, v_redeemed
    FROM public.bookings b
    WHERE b.id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_user_id IS NULL
       OR v_status NOT IN ('cancelled', 'rejected', 'no_show')
       OR POSITION('[LOYALTY_REFUNDED]' IN v_remark) > 0 THEN
        RETURN false;
    END IF;

    IF v_redeemed <= 0 THEN
        v_redeemed := COALESCE(
            NULLIF(SUBSTRING(v_note FROM '\[ใช้แต้ม xhaus:\s*(\d+(?:\.\d+)?)\s*เหรียญ'), '')::NUMERIC,
            0
        );
    END IF;

    v_free_drink := POSITION('[ใช้สิทธิ์แก้วฟรี 10 แถม 1' IN v_note) > 0
                    OR POSITION('| แก้วฟรี -฿' IN v_remark) > 0;

    SELECT COALESCE(pr.total_redeemed_xhaus, 0) INTO v_total_redeemed
    FROM public.profiles pr
    WHERE pr.id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    v_redeemed := LEAST(GREATEST(0, v_redeemed), v_total_redeemed);

    IF v_redeemed <= 0 AND NOT v_free_drink THEN
        RETURN false;
    END IF;

    UPDATE public.profiles AS pr
    SET xhaus_balance = COALESCE(pr.xhaus_balance, 0) + v_redeemed,
        total_redeemed_xhaus = COALESCE(pr.total_redeemed_xhaus, 0) - v_redeemed,
        free_drink_quota = COALESCE(pr.free_drink_quota, 0) + CASE WHEN v_free_drink THEN 1 ELSE 0 END
    WHERE pr.id = v_user_id;

    UPDATE public.bookings AS bk
    SET staff_remark = TRIM(v_remark || ' [LOYALTY_REFUNDED]')
    WHERE bk.id = p_booking_id;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_booking_loyalty(UUID) TO anon, authenticated, service_role;

COMMIT;
