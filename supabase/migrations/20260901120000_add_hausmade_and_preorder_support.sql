-- ==============================================================================
-- Migration: Add HAUSMADE & Pre-Order Native Schema Columns
-- Date: 2026-09-01
-- Tables: public.menu_items, public.bookings
-- ==============================================================================

-- 1. Add Pre-Order & Hausmade inventory columns to public.menu_items
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS preorder_eta TEXT,
ADD COLUMN IF NOT EXISTS sub_category TEXT,
ADD COLUMN IF NOT EXISTS is_hausmade BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_hero_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER,
ADD COLUMN IF NOT EXISTS remaining_stock INTEGER,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS origin TEXT,
ADD COLUMN IF NOT EXISTS tasting_notes TEXT,
ADD COLUMN IF NOT EXISTS craft_specs JSONB;

-- 2. Add Courier, Tracking & Shipping columns to public.bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS courier_name TEXT,
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS shipping_address TEXT,
ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS order_type TEXT,
ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS slip_verified_at TIMESTAMPTZ;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_items_preorder ON public.menu_items(is_preorder) WHERE is_preorder = true;
CREATE INDEX IF NOT EXISTS idx_menu_items_hausmade ON public.menu_items(is_hausmade) WHERE is_hausmade = true;
CREATE INDEX IF NOT EXISTS idx_bookings_order_type ON public.bookings(order_type);
CREATE INDEX IF NOT EXISTS idx_bookings_tracking_number ON public.bookings(tracking_number);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
