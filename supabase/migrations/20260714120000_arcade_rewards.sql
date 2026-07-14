-- 1. Create xhaus_rewards table
CREATE TABLE IF NOT EXISTS public.xhaus_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    xhaus_cost NUMERIC(10, 2) NOT NULL,
    claim_code TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for xhaus_rewards
ALTER TABLE public.xhaus_rewards ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow anyone to read active rewards
DROP POLICY IF EXISTS "Allow public select on xhaus_rewards" ON public.xhaus_rewards;
CREATE POLICY "Allow public select on xhaus_rewards" ON public.xhaus_rewards
    FOR SELECT USING (true);

-- Insert/Update/Delete policy: Admins only
DROP POLICY IF EXISTS "Allow admin write on xhaus_rewards" ON public.xhaus_rewards;
CREATE POLICY "Allow admin write on xhaus_rewards" ON public.xhaus_rewards
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'admin' OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Populate default mock rewards
INSERT INTO public.xhaus_rewards (title, description, xhaus_cost, claim_code, is_active) VALUES
('ของที่ระลึก: แก้วเซรามิค In The Haus', 'แลกรับแก้วเซรามิคสุดพรีเมียมเฉพาะคนในบ้าน', 50.00, 'IHGLASS50', true),
('เครื่องดื่ม: Signature Special Drink', 'แลกรับเครื่องดื่มเมนูลับสูตรพิเศษ 1 แก้ว', 30.00, 'IHBEER30', true),
('ของที่ระลึก: เสื้อยืด Exclusive T-Shirt', 'เสื้อยืดลิมิเต็ดเอดิชัน สีดำ Space Black', 120.00, 'IHTSHIRT', true),
('ส่วนลดบิล: ส่วนลดพิเศษ 50 บาท', 'แลกส่วนลดค่าอาหาร/เครื่องดื่มในร้าน 50 บาท', 40.00, 'IHDISC50', true)
ON CONFLICT (claim_code) DO NOTHING;

-- 2. Create arcade_rewards_log table
CREATE TABLE IF NOT EXISTS public.arcade_rewards_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    xhaus_rewarded NUMERIC(10, 2) DEFAULT 0.00,
    reward_type TEXT NOT NULL, -- 'pipe_20', 'pipe_35', 'raffle_40', 'weekly_top_1', 'raffle_draw_50'
    has_raffle_ticket BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for arcade_rewards_log
ALTER TABLE public.arcade_rewards_log ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow anyone to select their own logs or admin to select all
DROP POLICY IF EXISTS "Allow select arcade_rewards_log" ON public.arcade_rewards_log;
CREATE POLICY "Allow select arcade_rewards_log" ON public.arcade_rewards_log
    FOR SELECT USING (
        auth.uid() = profile_id OR 
        auth.jwt() ->> 'role' = 'admin' OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Insert policy: Allow authenticated inserts for own logs
DROP POLICY IF EXISTS "Allow insert arcade_rewards_log" ON public.arcade_rewards_log;
CREATE POLICY "Allow insert arcade_rewards_log" ON public.arcade_rewards_log
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Create index for quick date checking
CREATE INDEX IF NOT EXISTS arcade_rewards_log_date_idx ON public.arcade_rewards_log (profile_id, created_at);

-- 3. Database Function to securely claim arcade score rewards
CREATE OR REPLACE FUNCTION claim_arcade_rewards(p_score INTEGER)
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
    -- Resolve auth.uid() as user ID
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Time ranges in Asia/Bangkok
    v_today_start := timezone('Asia/Bangkok', CURRENT_DATE::timestamp);
    v_week_start := date_trunc('week', now() AT TIME ZONE 'Asia/Bangkok');

    -- 1. Check what has already been claimed TODAY by this user
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

    -- 2. Calculate sum of coins rewarded for pipe claims this week
    SELECT COALESCE(SUM(xhaus_rewarded), 0.00)
    INTO v_weekly_xhaus
    FROM public.arcade_rewards_log
    WHERE profile_id = v_user_id 
      AND reward_type IN ('pipe_20', 'pipe_35') 
      AND created_at >= v_week_start;

    -- 3. Evaluate criteria
    -- Criterion A: 20 pipes (easy) -> 1.00 xhaus
    IF p_score >= 20 AND NOT v_has_20 THEN
        IF v_weekly_xhaus + v_earned_xhaus < 5.00 THEN
            v_earned_xhaus := v_earned_xhaus + 1.00;
            -- Insert log
            INSERT INTO public.arcade_rewards_log (profile_id, score, xhaus_rewarded, reward_type)
            VALUES (v_user_id, p_score, 1.00, 'pipe_20');
        ELSE
            v_msg := v_msg || 'โควตาเหรียญสัปดาห์นี้เต็มแล้ว (ได้สูงสุด 5 xhaus); ';
        END IF;
    END IF;

    -- Criterion B: 35 pipes (teng) -> additional 1.00 xhaus
    IF p_score >= 35 AND NOT v_has_35 THEN
        IF v_weekly_xhaus + v_earned_xhaus < 5.00 THEN
            v_earned_xhaus := v_earned_xhaus + 1.00;
            -- Insert log
            INSERT INTO public.arcade_rewards_log (profile_id, score, xhaus_rewarded, reward_type)
            VALUES (v_user_id, p_score, 1.00, 'pipe_35');
        ELSE
            IF v_msg = '' OR v_msg NOT LIKE '%โควตาเหรียญสัปดาห์นี้เต็มแล้ว%' THEN
                v_msg := v_msg || 'โควตาเหรียญสัปดาห์นี้เต็มแล้ว; ';
            END IF;
        END IF;
    END IF;

    -- Criterion C: 40 pipes -> Raffle Ticket
    IF p_score >= 40 AND NOT v_has_raffle THEN
        v_earned_raffle := true;
        -- Insert log
        INSERT INTO public.arcade_rewards_log (profile_id, score, xhaus_rewarded, reward_type, has_raffle_ticket)
        VALUES (v_user_id, p_score, 0.00, 'raffle_40', true);
    END IF;

    -- Update user profiles balance if xhaus earned
    IF v_earned_xhaus > 0.00 THEN
        UPDATE public.profiles
        SET xhaus_balance = COALESCE(xhaus_balance, 0.00) + v_earned_xhaus,
            total_earned_xhaus = COALESCE(total_earned_xhaus, 0.00) + v_earned_xhaus
        WHERE id = v_user_id;
    END IF;

    -- Format response message
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

-- 4. Weekly drawing and resetting leaderboard
CREATE OR REPLACE FUNCTION draw_weekly_arcade_raffle_and_reset()
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
    -- Sunday/Monday start of current week
    v_week_start := date_trunc('week', now() AT TIME ZONE 'Asia/Bangkok');

    -- 1. Find Top player on leaderboard
    SELECT profile_id, display_name, score
    INTO v_top_player_id, v_top_player_name, v_top_score
    FROM public.leaderboard
    ORDER BY score DESC, created_at ASC
    LIMIT 1;

    -- Award Top Player 50 xhaus
    IF v_top_player_id IS NOT NULL THEN
        INSERT INTO public.arcade_rewards_log (profile_id, score, xhaus_rewarded, reward_type)
        VALUES (v_top_player_id, v_top_score, 50.00, 'weekly_top_1');

        UPDATE public.profiles
        SET xhaus_balance = COALESCE(xhaus_balance, 0.00) + 50.00,
            total_earned_xhaus = COALESCE(total_earned_xhaus, 0.00) + 50.00
        WHERE id = v_top_player_id;
    END IF;

    -- 2. Count current week's raffle tickets
    SELECT COUNT(DISTINCT profile_id)
    INTO v_raffle_tickets_count
    FROM public.arcade_rewards_log
    WHERE reward_type = 'raffle_40' AND created_at >= v_week_start;

    -- Draw Raffle Winner
    IF v_raffle_tickets_count > 0 THEN
        SELECT profile_id INTO v_raffle_winner_id
        FROM public.arcade_rewards_log
        WHERE reward_type = 'raffle_40' AND created_at >= v_week_start
        ORDER BY random()
        LIMIT 1;

        IF v_raffle_winner_id IS NOT NULL THEN
            -- Get display name
            SELECT COALESCE(nickname, display_name) INTO v_raffle_winner_name
            FROM public.profiles
            WHERE id = v_raffle_winner_id;

            -- Award Raffle winner 50 xhaus
            INSERT INTO public.arcade_rewards_log (profile_id, score, xhaus_rewarded, reward_type)
            VALUES (v_raffle_winner_id, 40, 50.00, 'raffle_draw_50');

            UPDATE public.profiles
            SET xhaus_balance = COALESCE(xhaus_balance, 0.00) + 50.00,
                total_earned_xhaus = COALESCE(total_earned_xhaus, 0.00) + 50.00
            WHERE id = v_raffle_winner_id;
        END IF;
    END IF;

    -- 3. Reset Leaderboard
    DELETE FROM public.leaderboard;

    RETURN jsonb_build_object(
        'success', true,
        'top_player', jsonb_build_object('name', COALESCE(v_top_player_name, '-'), 'score', COALESCE(v_top_score, 0)),
        'raffle_winner', jsonb_build_object('name', COALESCE(v_raffle_winner_name, '-'), 'tickets_checked', v_raffle_tickets_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
