-- ==============================================================================
-- Migration: Domain-Specific Partial Indexes for public.bookings
-- Purpose: Resolve Fat-Table Anti-Pattern by segregating Query Indexes by Domain
-- Date: 2026-09-03
-- ==============================================================================

-- 0. Ensure optional columns exist on public.bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 1. Domain: POS Active In-Store Tables (POS Table Layout, Live KDS, Customer Status)
-- Only indexes active/seated table orders (lightweight, zero bloat from old history)
CREATE INDEX IF NOT EXISTS idx_bookings_active_tables
ON public.bookings (table_id, status, booking_time)
WHERE status IN ('seated', 'confirmed', 'pending') AND table_id IS NOT NULL;

-- 2. Domain: Shift Cashier & Financial Calculations (shiftHelper, Reports, End-of-Day)
-- Accelerates shift metrics aggregation without full table scans
CREATE INDEX IF NOT EXISTS idx_bookings_shift_metrics
ON public.bookings (booking_time, status, order_type, booking_type)
WHERE status = 'completed';

-- 3. Domain: HAUSMADE Retail & Shipping (HausmadeAdminPage, Courier Exports, Packing)
-- Isolates e-commerce parcels from restaurant dine-in data
CREATE INDEX IF NOT EXISTS idx_bookings_hausmade_domain
ON public.bookings (status, created_at DESC)
WHERE booking_type = 'hausmade' OR order_type LIKE 'hausmade%';

-- 4. Domain: Store Pickups (POSPickupGrid & Pickup Station)
-- Enables 0ms rendering of food takeaway and boutique pickups
CREATE INDEX IF NOT EXISTS idx_bookings_pickup_domain
ON public.bookings (status, booking_time)
WHERE booking_type = 'pickup' OR order_type = 'hausmade_pickup';

-- 5. Domain: Delivery & LINE MAN Interceptor (POSOnlineHub, Rider Handover)
CREATE INDEX IF NOT EXISTS idx_bookings_delivery_domain
ON public.bookings (created_at DESC)
WHERE staff_remark LIKE '%[LINEMAN:%' OR source = 'delivery';

-- 6. Domain: Quick Tracking Token Lookup (TrackingPage, Customer Status)
CREATE INDEX IF NOT EXISTS idx_bookings_tracking_lookup
ON public.bookings (tracking_token)
WHERE tracking_token IS NOT NULL;

-- Notify PostgREST to refresh schema & planner cache
NOTIFY pgrst, 'reload schema';
