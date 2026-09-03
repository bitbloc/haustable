-- Migration: 20260903130000_enable_realtime_replication_for_core_tables.sql
-- Description: Ensure Supabase Realtime publication includes bookings, order_items, tables_layout, app_settings, pos_shifts

DO $$
BEGIN
    -- Ensure publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add core tables to supabase_realtime publication safely
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
    EXCEPTION WHEN duplicate_object THEN
        -- already in publication
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
    EXCEPTION WHEN duplicate_object THEN
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tables_layout;
    EXCEPTION WHEN duplicate_object THEN
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
    EXCEPTION WHEN duplicate_object THEN
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_shifts;
    EXCEPTION WHEN duplicate_object THEN
    END;
END $$;

-- Set REPLICA IDENTITY FULL for bookings and order_items so old & new payloads are sent
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.tables_layout REPLICA IDENTITY FULL;
