-- Add is_checked column to order_items
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS is_checked BOOLEAN DEFAULT FALSE;
