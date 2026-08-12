CREATE OR REPLACE FUNCTION process_drink_stamps(
    p_user_id UUID,
    p_stamp_count INT,
    p_quota_used INT
) RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET 
        drink_stamp_count = COALESCE(drink_stamp_count, 0) + p_stamp_count,
        total_drinks_purchased = COALESCE(total_drinks_purchased, 0) + p_stamp_count,
        free_drink_quota = COALESCE(free_drink_quota, 0) - p_quota_used
    WHERE id = p_user_id;

    UPDATE public.profiles
    SET 
        free_drink_quota = COALESCE(free_drink_quota, 0) + floor(drink_stamp_count / 10),
        drink_stamp_count = drink_stamp_count % 10
    WHERE id = p_user_id AND drink_stamp_count >= 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
