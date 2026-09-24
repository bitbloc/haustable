-- Migration: 20260925010000_order_items_snapshot_trigger_and_perf.sql
-- Description: Automated trigger for capturing order_items cost_at_sale, channel, and category snapshots.
-- Guarantees historical data integrity without forcing client code to manually query menu item costs.

DO $$ 
BEGIN
    -- 1. Ensure snapshot columns exist on order_items
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'order_items' 
          AND column_name = 'cost_at_sale'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN cost_at_sale NUMERIC(10, 2) DEFAULT 0.00;
        COMMENT ON COLUMN public.order_items.cost_at_sale IS 'Snapshot of ingredient/item cost at time of sale';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'order_items' 
          AND column_name = 'channel'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN channel VARCHAR(50) DEFAULT 'dine_in';
        COMMENT ON COLUMN public.order_items.channel IS 'Channel of sale snapshot (dine_in, takeaway, lineman, grab)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'order_items' 
          AND column_name = 'category_snapshot'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN category_snapshot VARCHAR(100) DEFAULT NULL;
        COMMENT ON COLUMN public.order_items.category_snapshot IS 'Category name snapshot at time of sale';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'order_items' 
          AND column_name = 'discount_applied'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN discount_applied NUMERIC(10, 2) DEFAULT 0.00;
        COMMENT ON COLUMN public.order_items.discount_applied IS 'Discount amount applied to this line item';
    END IF;
END $$;

-- 2. Create enrichment trigger function
CREATE OR REPLACE FUNCTION public.fn_order_items_enrich_snapshots()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fixed_cost NUMERIC(10, 2) := 0.00;
    v_booking_type VARCHAR(50) := 'dine_in';
    v_category_name VARCHAR(100) := NULL;
BEGIN
    -- A. Snapshot item cost if not already specified
    IF NEW.cost_at_sale IS NULL OR NEW.cost_at_sale = 0 THEN
        IF NEW.menu_item_id IS NOT NULL THEN
            SELECT COALESCE(fixed_cost, 0.00) INTO v_fixed_cost
            FROM public.menu_items
            WHERE id = NEW.menu_item_id;
            
            NEW.cost_at_sale := COALESCE(v_fixed_cost, 0.00);
        END IF;
    END IF;

    -- B. Snapshot channel from booking if not specified
    IF NEW.channel IS NULL OR NEW.channel = '' OR NEW.channel = 'dine_in' THEN
        IF NEW.booking_id IS NOT NULL THEN
            SELECT COALESCE(booking_type, 'dine_in') INTO v_booking_type
            FROM public.bookings
            WHERE id = NEW.booking_id;
            
            NEW.channel := COALESCE(v_booking_type, 'dine_in');
        END IF;
    END IF;

    -- C. Snapshot category name if not specified
    IF NEW.category_snapshot IS NULL OR NEW.category_snapshot = '' THEN
        IF NEW.menu_item_id IS NOT NULL THEN
            SELECT mc.name INTO v_category_name
            FROM public.menu_items mi
            LEFT JOIN public.menu_categories mc ON mi.category_id = mc.id
            WHERE mi.id = NEW.menu_item_id;

            NEW.category_snapshot := v_category_name;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Attach Trigger to order_items (BEFORE INSERT)
DROP TRIGGER IF EXISTS trg_order_items_enrich_snapshots ON public.order_items;
CREATE TRIGGER trg_order_items_enrich_snapshots
BEFORE INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_order_items_enrich_snapshots();

-- 4. Backfill historical records where fixed_cost exists on menu_items
UPDATE public.order_items oi
SET cost_at_sale = COALESCE(mi.fixed_cost, 0.00)
FROM public.menu_items mi
WHERE oi.menu_item_id = mi.id
  AND (oi.cost_at_sale IS NULL OR oi.cost_at_sale = 0)
  AND mi.fixed_cost > 0;

-- 5. Performance Indexes for Financial Cockpit Aggregations
CREATE INDEX IF NOT EXISTS idx_bookings_time_status_perf 
ON public.bookings (booking_time, status) 
INCLUDE (total_amount, discount_amount, pax);

CREATE INDEX IF NOT EXISTS idx_order_items_cogs_perf 
ON public.order_items (booking_id, cost_at_sale, price_at_time, quantity);

CREATE INDEX IF NOT EXISTS idx_order_items_channel_perf 
ON public.order_items (channel, created_at);
