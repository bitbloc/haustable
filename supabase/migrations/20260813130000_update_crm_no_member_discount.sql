-- Migration: Update CRM Tier Privileges - Point Collection Only (No Member Bill Discount)
-- Date: 2026-08-13
-- Description: Removes tier percentage discounts (0.00% discount) while retaining point accumulation multipliers (x1.0, x1.25, x1.50).

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

    -- Settle tier and privileges: Point collection model only (0% bill percentage discount)
    -- Base Earning Rate: 100 THB spent = 1 xhaus * tier multiplier
    --   - Inner Haus  (>= 12,000 THB/yr): Multiplier 1.50x (100 THB = 1.50 xhaus)
    --   - Haus People (>= 4,000 THB/yr) : Multiplier 1.25x (100 THB = 1.25 xhaus)
    --   - Haus Common (< 4,000 THB/yr)  : Multiplier 1.00x (100 THB = 1.00 xhaus)
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
