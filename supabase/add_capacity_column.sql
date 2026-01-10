-- Add capacity_per_unit column to stock_items
ALTER TABLE public.stock_items 
ADD COLUMN IF NOT EXISTS capacity_per_unit FLOAT DEFAULT NULL; -- e.g. 700 for 700ml

-- Comment
COMMENT ON COLUMN public.stock_items.capacity_per_unit IS 'Full capacity of one unit in ml (for liquid items)';
