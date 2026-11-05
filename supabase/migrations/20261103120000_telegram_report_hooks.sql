-- Migration: 20261103120000_telegram_report_hooks.sql
-- Description: Push store activity to Telegram via the `telegram-report` edge function.
--   * bookings     → table opened, online order, bill paid
--   * order_items  → items added (one message per insert batch, not per row)
--   * pos_shifts   → shift closed (cash count)
--   * pg_cron      → daily summary tick every 10 minutes (the function decides when to send)
--
-- One-time setup (after deploying the function):
--   supabase secrets set TELEGRAM_BOT_TOKEN=<token from @BotFather> TELEGRAM_HOOK_SECRET=<random string>
--   select vault.create_secret('<same random string>', 'telegram_hook_secret');
-- Then set Chat ID and enable it in Admin → Settings → Telegram.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Dispatcher: fire-and-forget HTTP call. Never raises, so POS writes are never blocked by Telegram.
CREATE OR REPLACE FUNCTION public.fn_telegram_dispatch(p_event TEXT, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_secret TEXT;
BEGIN
    IF COALESCE((SELECT value FROM public.app_settings WHERE key = 'telegram_enabled'), 'false') <> 'true' THEN
        RETURN;
    END IF;

    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'telegram_hook_secret' LIMIT 1;
    IF v_secret IS NULL THEN
        RETURN;
    END IF;

    PERFORM net.http_post(
        url := 'https://lxfavbzmebqqsffgyyph.supabase.co/functions/v1/telegram-report',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
        body := jsonb_build_object('event', p_event) || COALESCE(p_payload, '{}'::jsonb),
        timeout_milliseconds := 15000
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[telegram] dispatch % failed: %', p_event, SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_telegram_dispatch(TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- 2. bookings: table opened / online order / bill paid
CREATE OR REPLACE FUNCTION public.fn_bookings_telegram_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_online BOOLEAN := COALESCE(NEW.source, '') = 'online'
        OR COALESCE(NEW.booking_type, '') = 'hausmade'
        OR COALESCE(NEW.order_type, '') LIKE 'hausmade%';
    v_payload JSONB := jsonb_build_object('booking_id', NEW.id);
BEGIN
    IF COALESCE(NEW.pickup_contact_name, '') = 'MAINTENANCE' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF v_is_online THEN
            PERFORM public.fn_telegram_dispatch('online_order', v_payload);
        ELSIF NEW.status = 'seated' AND NEW.table_id IS NOT NULL THEN
            PERFORM public.fn_telegram_dispatch('table_opened', v_payload);
        END IF;

        IF NEW.status = 'completed' THEN
            PERFORM public.fn_telegram_dispatch('bill_paid', v_payload);
        END IF;
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        -- Reservation arrived, or QR order approved by staff
        IF NEW.status = 'seated' AND NEW.table_id IS NOT NULL
           AND COALESCE(OLD.status, '') IN ('pending', 'confirmed') THEN
            PERFORM public.fn_telegram_dispatch('table_opened', v_payload);
        END IF;

        IF NEW.status = 'completed' THEN
            PERFORM public.fn_telegram_dispatch('bill_paid', v_payload);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_telegram_notify ON public.bookings;
CREATE TRIGGER trg_bookings_telegram_notify
AFTER INSERT OR UPDATE OF status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.fn_bookings_telegram_notify();

-- 3. order_items: statement-level so a 10-item order sends one message, not ten
CREATE OR REPLACE FUNCTION public.fn_order_items_telegram_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT booking_id, jsonb_agg(id) AS item_ids
        FROM new_rows
        WHERE booking_id IS NOT NULL
        GROUP BY booking_id
    LOOP
        PERFORM public.fn_telegram_dispatch('items_added', jsonb_build_object('booking_id', r.booking_id, 'item_ids', r.item_ids));
    END LOOP;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_telegram_notify ON public.order_items;
CREATE TRIGGER trg_order_items_telegram_notify
AFTER INSERT ON public.order_items
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.fn_order_items_telegram_notify();

-- 4. pos_shifts: shift closed
CREATE OR REPLACE FUNCTION public.fn_pos_shifts_telegram_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.closed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.closed_at IS NULL) THEN
        PERFORM public.fn_telegram_dispatch('shift_closed', jsonb_build_object('shift_id', NEW.id));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_shifts_telegram_notify ON public.pos_shifts;
CREATE TRIGGER trg_pos_shifts_telegram_notify
AFTER INSERT OR UPDATE OF closed_at ON public.pos_shifts
FOR EACH ROW
EXECUTE FUNCTION public.fn_pos_shifts_telegram_notify();

-- 5. Daily summary tick (function sends once per day at telegram_daily_summary_time, Asia/Bangkok)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-daily-summary') THEN
        PERFORM cron.unschedule('telegram-daily-summary');
    END IF;
END $$;

SELECT cron.schedule(
    'telegram-daily-summary',
    '*/10 * * * *',
    $$SELECT public.fn_telegram_dispatch('daily_tick', '{}'::jsonb)$$
);

-- 6. Default settings (disabled until the owner sets a chat id)
INSERT INTO public.app_settings (key, value) VALUES
    ('telegram_enabled', 'false'),
    ('telegram_chat_id', ''),
    ('telegram_notify_table_open', 'true'),
    ('telegram_notify_items', 'true'),
    ('telegram_notify_bill', 'true'),
    ('telegram_notify_online', 'true'),
    ('telegram_notify_shift', 'true'),
    ('telegram_daily_summary', 'true'),
    ('telegram_daily_summary_time', '03:00')
ON CONFLICT (key) DO NOTHING;
