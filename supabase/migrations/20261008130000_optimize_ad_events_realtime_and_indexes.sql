-- Migration: 20261008130000_optimize_ad_events_realtime_and_indexes.sql
-- Description: Enable Supabase Realtime for ad_events, add composite indexes, allow authenticated prune/delete, and seed verified contact URLs

-- 1. Ensure composite indexes for high-speed date range and attribution aggregations
CREATE INDEX IF NOT EXISTS idx_ad_events_created_at_event_name 
    ON public.ad_events (created_at DESC, event_name);

CREATE INDEX IF NOT EXISTS idx_ad_events_utm_source_created 
    ON public.ad_events (utm_source, created_at DESC);

-- 2. Enable Realtime Replication for ad_events table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_events;
    EXCEPTION WHEN duplicate_object THEN
        -- already in publication
    END;
END $$;

ALTER TABLE public.ad_events REPLICA IDENTITY FULL;

-- 3. Enhance RLS Policies on ad_events (Allow authenticated delete for cleanup / test pruning)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ad_events' AND policyname = 'Allow authenticated delete ad_events'
    ) THEN
        CREATE POLICY "Allow authenticated delete ad_events"
            ON public.ad_events FOR DELETE
            TO authenticated
            USING (true);
    END IF;
END $$;

-- 4. Update legacy / dead contact and direction links in app_settings to verified Google Maps URL
INSERT INTO public.app_settings (key, value)
VALUES 
    ('contact_map_url', 'https://maps.app.goo.gl/ZkjCsDkQdJi4g2EN7'),
    ('link_url_4', 'https://maps.app.goo.gl/ZkjCsDkQdJi4g2EN7'),
    ('link_url_1', 'https://lin.ee/EuzwG7c'),
    ('link_url_2', 'https://www.instagram.com/inthehausth/'),
    ('link_url_3', 'https://www.facebook.com/inthehausth/')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value
WHERE app_settings.value LIKE '%3qjFz8N7cK6R4g969%' 
   OR app_settings.value LIKE '%TfTD3xATqRCrQmiF9%'
   OR app_settings.value = 'https://maps.google.com'
   OR app_settings.value = 'https://lin.ee/xyz'
   OR app_settings.value = 'https://instagram.com'
   OR app_settings.value = 'https://facebook.com';
