-- Migration: Allow public (anon + authenticated) read on ad_events
-- This ensures the backoffice Intraday Cockpit, Ad Analytics Tab, and Radar
-- can always fetch ad_events seamlessly regardless of auth session status or client role.

DROP POLICY IF EXISTS "Allow authenticated read ad_events" ON public.ad_events;
DROP POLICY IF EXISTS "Allow public read ad_events" ON public.ad_events;

CREATE POLICY "Allow public read ad_events"
    ON public.ad_events FOR SELECT
    TO anon, authenticated
    USING (true);

-- Ensure public insert is always enabled
DROP POLICY IF EXISTS "Allow public insert to ad_events" ON public.ad_events;

CREATE POLICY "Allow public insert to ad_events"
    ON public.ad_events FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Ensure grant permissions
GRANT SELECT, INSERT ON public.ad_events TO anon, authenticated, service_role;
