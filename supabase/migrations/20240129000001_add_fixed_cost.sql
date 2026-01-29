-- Add fixed_cost to stock_items
ALTER TABLE public.stock_items 
ADD COLUMN IF NOT EXISTS fixed_cost NUMERIC DEFAULT 0;

-- Add fixed_cost to menu_items
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS fixed_cost NUMERIC DEFAULT 0;
