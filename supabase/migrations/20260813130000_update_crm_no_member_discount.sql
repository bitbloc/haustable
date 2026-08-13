-- Ensure current_tier column exists on profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_tier TEXT DEFAULT 'Haus Common';

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

    -- Synchronize profile table current_tier column so all receipt printers & POS selects see exact updated tier
    UPDATE public.profiles AS p
    SET current_tier = v_tier
    WHERE p.id = p_user_id AND (p.current_tier IS DISTINCT FROM v_tier);

    RETURN QUERY SELECT v_spent_12m, v_spent_13m, v_tier, v_mult, v_disc, v_grace;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update all beverage & coffee categories (including shot/espresso) as drink stamp eligible
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

-- Update menu items directly matching espresso, shot, coffee, tea keywords
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
