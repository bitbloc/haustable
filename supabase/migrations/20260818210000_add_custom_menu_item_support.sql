-- Migration: Add custom menu item support for POS Emergency / Custom on-the-fly items
-- Allows staff to add custom items with on-the-fly pricing, custom names, and destination routing (kitchen/bar/other)

ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS custom_name TEXT,
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS destination TEXT DEFAULT 'kitchen';

-- Ensure menu_item_id is nullable for custom items without catalog IDs
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'order_items' 
          AND column_name = 'menu_item_id' 
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.order_items ALTER COLUMN menu_item_id DROP NOT NULL;
    END IF;
END $$;

COMMENT ON COLUMN public.order_items.custom_name IS 'Custom on-the-fly menu item name entered by POS staff';
COMMENT ON COLUMN public.order_items.is_custom IS 'Flag indicating whether item is an emergency/custom priced item';
COMMENT ON COLUMN public.order_items.destination IS 'Print routing destination: kitchen, bar, or other';
