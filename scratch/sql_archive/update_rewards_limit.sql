-- 1. Add columns to public.xhaus_rewards
ALTER TABLE public.xhaus_rewards 
ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0 NOT NULL;

-- 2. Add column to public.bookings
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS xhaus_reward_id UUID REFERENCES public.xhaus_rewards(id);

-- 3. Create or update trigger function to handle reward usage
CREATE OR REPLACE FUNCTION public.handle_reward_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reward RECORD;
BEGIN
    -- Only run when status becomes 'completed' and xhaus_reward_id is set
    -- For UPDATE, ensure it wasn't already completed (to avoid double counting)
    IF (TG_OP = 'INSERT' AND NEW.status = 'completed' AND NEW.xhaus_reward_id IS NOT NULL) OR
       (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND NEW.xhaus_reward_id IS NOT NULL and (OLD.status IS NULL OR OLD.status <> 'completed')) THEN
        
        -- LOCK the reward row to prevent race conditions
        SELECT * INTO v_reward 
        FROM public.xhaus_rewards 
        WHERE id = NEW.xhaus_reward_id 
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Reward not found';
        END IF;

        IF NOT v_reward.is_active THEN
            RAISE EXCEPTION 'Reward is inactive';
        END IF;

        IF v_reward.usage_limit IS NOT NULL AND v_reward.used_count >= v_reward.usage_limit THEN
            RAISE EXCEPTION 'Reward fully redeemed / สิทธิ์ของรางวัลนี้ถูกแลกครบจำนวนแล้ว';
        END IF;

        -- Increment Usage
        UPDATE public.xhaus_rewards 
        SET used_count = used_count + 1 
        WHERE id = v_reward.id;

    END IF;

    RETURN NEW;
END;
$$;

-- 4. Create trigger on bookings
DROP TRIGGER IF EXISTS trigger_apply_reward ON public.bookings;
CREATE TRIGGER trigger_apply_reward
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_reward_usage();
