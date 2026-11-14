-- ==============================================================================
-- Telegram: stock closing summary
--
-- When a closing count is saved (stock_count_sessions kind = 'closing'), send the
-- day's result to the Telegram chat set in Admin -> Settings -> Telegram:
-- items off by more than 5% and ฿100 (worst first, with the baht short), and
-- items at or below their reorder point.
--
-- Uses the existing dispatcher fn_telegram_dispatch (20261103120000), which never
-- raises, so a Telegram problem can never block saving a count. pg_net sends the
-- request after the count's transaction commits, so the lines are already there.
-- Needs the telegram-report edge function version that knows 'stock_closing'.
-- Safe to re-run.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_stock_count_telegram_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.kind = 'closing' AND to_regprocedure('public.fn_telegram_dispatch(text, jsonb)') IS NOT NULL THEN
        PERFORM public.fn_telegram_dispatch('stock_closing',
            jsonb_build_object('session_id', NEW.id, 'shop_day', NEW.shop_day));
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[telegram] stock closing notify failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_count_telegram_notify ON public.stock_count_sessions;
CREATE TRIGGER trg_stock_count_telegram_notify
AFTER INSERT ON public.stock_count_sessions
FOR EACH ROW
EXECUTE FUNCTION public.fn_stock_count_telegram_notify();

REVOKE ALL ON FUNCTION public.fn_stock_count_telegram_notify() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
    IF to_regclass('public.app_settings') IS NOT NULL THEN
        INSERT INTO public.app_settings (key, value) VALUES ('telegram_notify_stock', 'true')
        ON CONFLICT (key) DO NOTHING;
    END IF;
END $$;
