-- Add makro tracking columns to stock_items
ALTER TABLE public.stock_items 
ADD COLUMN IF NOT EXISTS makro_id VARCHAR,
ADD COLUMN IF NOT EXISTS makro_sku VARCHAR;
