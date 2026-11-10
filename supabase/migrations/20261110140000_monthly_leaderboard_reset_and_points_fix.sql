-- =============================================================================
-- Migration: Monthly Leaderboard Auto-Reset & Arcade Score/Point Accuracy Fix
-- Date: 2026-11-10
-- Purpose:
--   1. Automatically purge leaderboard entries from previous months so no stale
--      scores remain stuck across monthly boundaries (Asia/Bangkok UTC+7).
--   2. Add RLS policy & BEFORE INSERT/UPDATE trigger on public.leaderboard to
--      guarantee automatic monthly cleanup.
--   3. Fix Asia/Bangkok timezone boundary calculation in claim_arcade_rewards()
--      and draw_weekly_arcade_raffle_and_reset() so daily quests (20 PTS / 35 PTS /
--      40 PTS raffle) and the 5.00 XH weekly cap are 100% accurate.
-- =============================================================================

-- 1. Purge any existing leaderboard entries from previous months (Asia/Bangkok)
DELETE FROM public.leaderboard
WHERE created_at < (date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok');

-- 2. Allow deleting expired previous-month leaderboard rows via RLS
DROP POLICY IF EXISTS "Allow deleting expired monthly leaderboard scores" ON public.leaderboard;
CREATE POLICY "Allow deleting expired monthly leaderboard scores"
ON public.leaderboard FOR DELETE
TO anon, authenticated
USING (
  created_at < (date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok')
);

-- 3. Trigger function to auto-purge previous month's scores whenever leaderboard is written
CREATE OR REPLACE FUNCTION public.purge_stale_monthly_leaderboard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start TIMESTAMPTZ;
BEGIN
  v_month_start := date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok';
  DELETE FROM public.leaderboard
  WHERE created_at < v_month_start;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_stale_monthly_leaderboard ON public.leaderboard;
CREATE TRIGGER trg_purge_stale_monthly_leaderboard
AFTER INSERT OR UPDATE ON public.leaderboard
FOR EACH STATEMENT
EXECUTE FUNCTION public.purge_stale_monthly_leaderboard();

-- 4. Fix claim_arcade_rewards(p_score) timezone boundaries & point calculations
CREATE OR REPLACE FUNCTION public.claim_arcade_rewards(p_score INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_today_start TIMESTAMPTZ;
    v_week_start TIMESTAMPTZ;
    v_month_start TIMESTAMPTZ;
    v_weekly_coins NUMERIC(10, 2);
    v_coins_to_award NUMERIC(10, 2) := 0.00;
    v_reward_20_claimed BOOLEAN := FALSE;
    v_reward_35_claimed BOOLEAN := FALSE;
    v_raffle_40_claimed BOOLEAN := FALSE;
    v_raffle_awarded BOOLEAN := FALSE;
    v_msg TEXT := '';
BEGIN
    v_user_id := (select auth.uid());
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Accurate Asia/Bangkok (UTC+7) day, week (Monday), and month boundaries
    v_today_start := date_trunc('day', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok';
    v_week_start  := date_trunc('week', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok';
    v_month_start := date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok';

    -- Ensure stale previous-month leaderboard entries are purged
    DELETE FROM public.leaderboard
    WHERE created_at < v_month_start;

    -- 1. Check total coins earned this week (Cap is 5.00 XH)
    SELECT COALESCE(SUM(xhaus_rewarded), 0.00)
    INTO v_weekly_coins
    FROM public.arcade_rewards_log
    WHERE profile_id = v_user_id
      AND reward_type IN ('pipe_20', 'pipe_35')
      AND created_at >= v_week_start;

    -- 2. Check today's already claimed milestones
    SELECT 
        BOOL_OR(reward_type = 'pipe_20'),
        BOOL_OR(reward_type = 'pipe_35'),
        BOOL_OR(reward_type = 'raffle_40')
    INTO 
        v_reward_20_claimed,
        v_reward_35_claimed,
        v_raffle_40_claimed
    FROM public.arcade_rewards_log
    WHERE profile_id = v_user_id
      AND created_at >= v_today_start;

    v_reward_20_claimed := COALESCE(v_reward_20_claimed, FALSE);
    v_reward_35_claimed := COALESCE(v_reward_35_claimed, FALSE);
    v_raffle_40_claimed := COALESCE(v_raffle_40_claimed, FALSE);

    -- 3. Evaluate Milestone: 20 Points (+1.00 XH)
    IF p_score >= 20 AND NOT v_reward_20_claimed THEN
        IF (v_weekly_coins + v_coins_to_award + 1.00) <= 5.00 THEN
            v_coins_to_award := v_coins_to_award + 1.00;
            INSERT INTO public.arcade_rewards_log (profile_id, reward_type, score, xhaus_rewarded)
            VALUES (v_user_id, 'pipe_20', p_score, 1.00);
        END IF;
    END IF;

    -- 4. Evaluate Milestone: 35 Points (+1.00 XH)
    IF p_score >= 35 AND NOT v_reward_35_claimed THEN
        IF (v_weekly_coins + v_coins_to_award + 1.00) <= 5.00 THEN
            v_coins_to_award := v_coins_to_award + 1.00;
            INSERT INTO public.arcade_rewards_log (profile_id, reward_type, score, xhaus_rewarded)
            VALUES (v_user_id, 'pipe_35', p_score, 1.00);
        END IF;
    END IF;

    -- 5. Evaluate Milestone: 40 Points (1 Raffle Ticket per day)
    IF p_score >= 40 AND NOT v_raffle_40_claimed THEN
        v_raffle_awarded := TRUE;
        INSERT INTO public.arcade_rewards_log (profile_id, reward_type, score, xhaus_rewarded)
        VALUES (v_user_id, 'raffle_40', p_score, 0.00);
    END IF;

    -- 6. Update User Profile Balance if coins were awarded
    IF v_coins_to_award > 0 THEN
        UPDATE public.profiles
        SET xhaus_balance = COALESCE(xhaus_balance, 0.00) + v_coins_to_award
        WHERE id = v_user_id;
    END IF;

    -- 7. Construct user-friendly result message
    IF v_coins_to_award > 0 AND v_raffle_awarded THEN
        v_msg := 'ยินดีด้วย! คุณได้รับ +' || v_coins_to_award || ' xhaus และ 1 ตั๋วสุ่มรางวัลใหญ่ประจำสัปดาห์!';
    ELSIF v_coins_to_award > 0 THEN
        v_msg := 'เยี่ยมมาก! คุณได้รับ +' || v_coins_to_award || ' xhaus จากการทำลายสถิติวันนี้!';
    ELSIF v_raffle_awarded THEN
        v_msg := 'สุดยอด! คุณได้รับ 1 ตั๋วสุ่มรางวัลใหญ่ประจำสัปดาห์! (โควต้าเหรียญรายสัปดาห์ครบ 5 xhaus แล้ว)';
    ELSE
        IF p_score < 20 THEN
            v_msg := 'บันทึกสถิติสำเร็จ! (ทำคะแนนให้ถึง 20 แต้มเพื่อรับเหรียญ xhaus ฟรี)';
        ELSIF v_weekly_coins >= 5.00 THEN
            v_msg := 'บันทึกสถิติสำเร็จ! (คุณสะสมเหรียญครบโควต้า 5 xhaus ของสัปดาห์นี้แล้ว)';
        ELSE
            v_msg := 'บันทึกสถิติสำเร็จ! (คุณได้รับสิทธิ์เหรียญและตั๋วของระดับคะแนนนี้ในวันนี้ไปแล้ว)';
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'coins_awarded', v_coins_to_award,
        'raffle_awarded', v_raffle_awarded,
        'weekly_total', v_weekly_coins + v_coins_to_award,
        'message', v_msg
    );
END;
$$;

-- 5. Fix draw_weekly_arcade_raffle_and_reset() to use accurate Asia/Bangkok boundaries
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

