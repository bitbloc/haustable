-- Add dynamic fixed cost columns to stock_items
ALTER TABLE public.stock_items 
ADD COLUMN IF NOT EXISTS fixed_cost_details JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_fixed_cost_included BOOLEAN DEFAULT true;

-- Add dynamic fixed cost columns to menu_items
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS fixed_cost_details JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_fixed_cost_included BOOLEAN DEFAULT true;
