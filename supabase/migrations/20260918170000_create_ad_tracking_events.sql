-- Migration: Create ad_events table for Ad Landing Page (/link) analytics and attribution
CREATE TABLE IF NOT EXISTS public.ad_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT,
    event_name TEXT NOT NULL,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    device_type TEXT,
    page_path TEXT DEFAULT '/link',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing for high-velocity aggregations
CREATE INDEX IF NOT EXISTS idx_ad_events_created_at ON public.ad_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_events_event_name ON public.ad_events (event_name);
CREATE INDEX IF NOT EXISTS idx_ad_events_utm_source ON public.ad_events (utm_source);
CREATE INDEX IF NOT EXISTS idx_ad_events_session_id ON public.ad_events (session_id);

-- RLS policies: Allow anonymous users visiting /link to log events, and backoffice staff to read
ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ad_events' AND policyname = 'Allow public insert to ad_events'
    ) THEN
        CREATE POLICY "Allow public insert to ad_events"
            ON public.ad_events FOR INSERT
            TO anon, authenticated
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ad_events' AND policyname = 'Allow authenticated read ad_events'
    ) THEN
        CREATE POLICY "Allow authenticated read ad_events"
            ON public.ad_events FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END $$;
