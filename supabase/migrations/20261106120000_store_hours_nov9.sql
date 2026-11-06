-- Migration: 20261106120000_store_hours_nov9.sql
-- Description: New store hours from Mon 9 Nov 2026 (Asia/Bangkok):
--   open 11:00 - 21:30, food last order 20:45. Categories flagged hide_on_kitchen_close
--   stay hidden after last order, so only the drinks already configured remain orderable.
-- A one-shot pg_cron job applies the values at 00:00 Bangkok on 9 Nov, then removes itself.

CREATE OR REPLACE FUNCTION public.fn_apply_store_hours_nov9()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.app_settings (key, value) VALUES
        ('opening_time', '11:00'),
        ('closing_time', '21:30'),
        ('qr_kitchen_open_time', '11:00'),
        ('qr_kitchen_close_time', '20:45'),
        ('booking_time_slots', '11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00, 20:00')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

    UPDATE public.app_settings
    SET value = replace(replace(replace(value,
            'เวลา 21.00 น.', 'เวลา 20.45 น.'),
            'จนถึงเวลาครัวปิด 22.00 น.', 'จนถึงเวลาร้านปิด 21.30 น.'),
            'เลยเวลา 23.30 น.', 'เลยเวลา 21.30 น.')
    WHERE key = 'policy_pickup';
END;
$$;

REVOKE ALL ON FUNCTION public.fn_apply_store_hours_nov9() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'store-hours-nov9') THEN
        PERFORM cron.unschedule('store-hours-nov9');
    END IF;
END $$;

-- pg_cron runs in UTC: 00:00 Bangkok on 9 Nov = 17:00 UTC on 8 Nov.
SELECT cron.schedule(
    'store-hours-nov9',
    '0 17 8 11 *',
    $$SELECT public.fn_apply_store_hours_nov9(); SELECT cron.unschedule('store-hours-nov9');$$
);
