-- Add display_order column to menu_items table if it doesn't exist
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS display_order SERIAL;

-- Optional: Update existing items to have a default order based on name or creation
-- UPDATE public.menu_items SET display_order = id WHERE display_order IS NULL;
