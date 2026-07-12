-- 1. Add CRM xhaus fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xhaus_balance NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_earned_xhaus NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_redeemed_xhaus NUMERIC(10, 2) DEFAULT 0.00;

-- 2. Add CRM xhaus fields to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS xhaus_earned NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS xhaus_redeemed NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS xhaus_discount NUMERIC(10, 2) DEFAULT 0.00;

-- 3. Set up default settings in app_settings table
INSERT INTO app_settings (key, value) VALUES 
('crm_welcome_xhaus', '10.00'),
('crm_redeem_rate_xhaus', '1.00'), -- 1 xhaus = 1 Baht
('crm_min_redeem_xhaus', '10.00')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Create function to calculate dynamic member spent and tier
CREATE OR REPLACE FUNCTION get_member_tier_details(p_user_id uuid)
RETURNS TABLE (
    accumulated_spent_12m NUMERIC(10, 2),
    accumulated_spent_13m NUMERIC(10, 2),
    current_tier TEXT,
    multiplier NUMERIC(3, 2),
    is_in_grace_period BOOLEAN
) AS $$
DECLARE
    v_spent_12m NUMERIC(10, 2);
    v_spent_13m NUMERIC(10, 2);
    v_tier TEXT;
    v_mult NUMERIC(3, 2);
    v_grace BOOLEAN := false;
BEGIN
    -- Sum of net totals (final bill total_amount) in last 12 months (365 days)
    SELECT COALESCE(SUM(total_amount), 0.00)
    INTO v_spent_12m
    FROM bookings
    WHERE user_id = p_user_id AND status = 'completed' AND created_at >= NOW() - INTERVAL '12 months';

    -- Sum of net totals in last 13 months (12 months + 30 days grace period)
    SELECT COALESCE(SUM(total_amount), 0.00)
    INTO v_spent_13m
    FROM bookings
    WHERE user_id = p_user_id AND status = 'completed' AND created_at >= NOW() - INTERVAL '13 months';

    -- Settle tier based on customer's exact relationship rules
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

    RETURN QUERY SELECT v_spent_12m, v_spent_13m, v_tier, v_mult, v_grace;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC function to complete checkout with xhaus updates
CREATE OR REPLACE FUNCTION process_checkout_xhaus(
    p_booking_id bigint,
    p_xhaus_earned NUMERIC(10, 2),
    p_xhaus_redeemed NUMERIC(10, 2),
    p_xhaus_discount NUMERIC(10, 2)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Find attached user
    SELECT user_id INTO v_user_id FROM bookings WHERE id = p_booking_id;

    -- Update booking with xhaus records
    UPDATE bookings
    SET xhaus_earned = p_xhaus_earned,
        xhaus_redeemed = p_xhaus_redeemed,
        xhaus_discount = p_xhaus_discount
    WHERE id = p_booking_id;

    -- Update profile balances if user exists
    IF v_user_id IS NOT NULL THEN
        UPDATE profiles
        SET xhaus_balance = COALESCE(xhaus_balance, 0.00) + p_xhaus_earned - p_xhaus_redeemed,
            total_earned_xhaus = COALESCE(total_earned_xhaus, 0.00) + p_xhaus_earned,
            total_redeemed_xhaus = COALESCE(total_redeemed_xhaus, 0.00) + p_xhaus_redeemed
        WHERE id = v_user_id;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger function to grant welcome xhaus to new members automatically
CREATE OR REPLACE FUNCTION grant_welcome_xhaus()
RETURNS TRIGGER AS $$
DECLARE
    v_welcome_val NUMERIC(10, 2);
BEGIN
    -- Fetch welcome setting
    SELECT COALESCE(value::NUMERIC, 10.00) INTO v_welcome_val FROM app_settings WHERE key = 'crm_welcome_xhaus';
    
    NEW.xhaus_balance := v_welcome_val;
    NEW.total_earned_xhaus := v_welcome_val;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Register trigger
DROP TRIGGER IF EXISTS on_profile_created_welcome_xhaus ON profiles;
CREATE TRIGGER on_profile_created_welcome_xhaus
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION grant_welcome_xhaus();
