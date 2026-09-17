-- ==============================================================================
-- Migration: POS Ultra-Performance & Precision Compound Partial Indexes
-- Purpose: Sub-millisecond lookup for active tables, pending queue, and order items
-- Date: 2026-09-18
-- ==============================================================================

-- 1. Upgrade Active Tables Partial Index to include 'ready' status
-- Matches query predicate: status IN ('pending', 'seated', 'confirmed', 'ready')
DROP INDEX IF EXISTS public.idx_bookings_active_tables;
CREATE INDEX IF NOT EXISTS idx_bookings_active_tables
ON public.bookings (table_id, status, booking_time DESC)
WHERE status IN ('seated', 'confirmed', 'pending', 'ready') AND table_id IS NOT NULL;

-- 2. Compound Partial Index for POS Safety Heartbeat & Pending Queue
-- Eliminates sequential scans during checkPendingOrders() and checkUnprintedQrOrders()
CREATE INDEX IF NOT EXISTS idx_bookings_pending_queue
ON public.bookings (status, created_at DESC, booking_time DESC)
WHERE status IN ('pending', 'confirmed', 'seated', 'ready');

-- 3. High-throughput Index for Order Items Destination & Routing
-- Accelerates KDS, Bar, and Kitchen slip generation
CREATE INDEX IF NOT EXISTS idx_order_items_booking_dest
ON public.order_items (booking_id, destination, created_at);

-- 4. Shift Chronological Date-Range Index for Admin Overview & Cash Flow
CREATE INDEX IF NOT EXISTS idx_pos_shifts_opened_at
ON public.pos_shifts (opened_at DESC);

-- 5. Ensure default_vat_enabled setting exists in app_settings (Default: 'true')
INSERT INTO public.app_settings (key, value)
VALUES ('default_vat_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- 6. Notify PostgREST to reload schema and planner cache
NOTIFY pgrst, 'reload schema';

