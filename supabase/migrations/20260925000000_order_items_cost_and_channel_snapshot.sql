-- Migration: 20260925000000_order_items_cost_and_channel_snapshot.sql
-- Description: Add snapshot columns to order_items to preserve historical COGS and price integrity.
-- Prevents retroactive historical report skewing when menu item prices or recipe costs are updated.

DO $$ 
BEGIN
    -- 1. cost_at_sale: Snapshot of food/beverage unit cost at the exact time of order
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'order_items' 
          AND column_name = 'cost_at_sale'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN cost_at_sale NUMERIC(10, 2) DEFAULT 0;
        COMMENT ON COLUMN public.order_items.cost_at_sale IS 'Snapshot of unit food/raw ingredient cost at time of sale';
    END IF;

    -- 2. channel: Dining channel snapshot (dine_in, takeaway, lineman, grab, direct)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'order_items' 
          AND column_name = 'channel'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN channel VARCHAR(30) DEFAULT 'dine_in';
        COMMENT ON COLUMN public.order_items.channel IS 'Channel of sale (dine_in, takeaway, lineman, grab)';
    END IF;

    -- 3. discount_applied: Line-item discount snapshot
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'order_items' 
          AND column_name = 'discount_applied'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN discount_applied NUMERIC(10, 2) DEFAULT 0;
        COMMENT ON COLUMN public.order_items.discount_applied IS 'Discount amount applied specifically to this item';
    END IF;

    -- 4. category_snapshot: Menu category snapshot
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'order_items' 
          AND column_name = 'category_snapshot'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN category_snapshot VARCHAR(100) DEFAULT NULL;
        COMMENT ON COLUMN public.order_items.category_snapshot IS 'Category name snapshot at time of sale';
    END IF;
END $$;

-- Indexes for lightning-fast historical margin and channel aggregations
CREATE INDEX IF NOT EXISTS idx_order_items_channel_created 
ON public.order_items (channel, created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_cogs_snapshot 
ON public.order_items (booking_id, cost_at_sale, price_at_time);
