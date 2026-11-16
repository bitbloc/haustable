-- ==============================================================================
-- Migration: durable "call staff" for tables without an open bill
-- Purpose : A free table's staff call was only a realtime broadcast. If the POS was
--           offline or restarting at that moment the call was lost, while the customer
--           saw "staff called". The customer page now also inserts a row here and the
--           POS safety heartbeat reads uncleared rows, so the call is recovered.
-- Safe to run while the shop is open: it only adds a new table. Until it is applied the
-- app keeps the previous behaviour (src/utils/tableStaffCalls.js is best-effort).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.table_staff_calls (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_id    bigint NOT NULL REFERENCES public.tables_layout(id) ON DELETE CASCADE,
    table_name  text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    cleared_at  timestamptz
);

-- Only the handful of open calls are ever scanned
CREATE INDEX IF NOT EXISTS idx_table_staff_calls_open
ON public.table_staff_calls (created_at DESC)
WHERE cleared_at IS NULL;

ALTER TABLE public.table_staff_calls ENABLE ROW LEVEL SECURITY;

-- The customer page and the POS both run without a Supabase login today (same as bookings).
-- Rows hold no personal data: a table id, a table name and two timestamps.
DROP POLICY IF EXISTS "table_staff_calls_insert" ON public.table_staff_calls;
CREATE POLICY "table_staff_calls_insert" ON public.table_staff_calls
    FOR INSERT TO anon, authenticated
    WITH CHECK (cleared_at IS NULL);

DROP POLICY IF EXISTS "table_staff_calls_select" ON public.table_staff_calls;
CREATE POLICY "table_staff_calls_select" ON public.table_staff_calls
    FOR SELECT TO anon, authenticated
    USING (true);

-- Clearing = setting cleared_at; nothing else may be changed back to "open"
DROP POLICY IF EXISTS "table_staff_calls_clear" ON public.table_staff_calls;
CREATE POLICY "table_staff_calls_clear" ON public.table_staff_calls
    FOR UPDATE TO anon, authenticated
    USING (cleared_at IS NULL)
    WITH CHECK (cleared_at IS NOT NULL);

GRANT SELECT, INSERT, UPDATE ON public.table_staff_calls TO anon, authenticated;
