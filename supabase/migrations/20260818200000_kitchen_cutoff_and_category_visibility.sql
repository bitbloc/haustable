-- Migration: Kitchen Cutoff and Category Visibility for QR Ordering
-- Description: Adds hide_on_kitchen_close to menu_categories and sets up app_settings for 22:00 kitchen cutoff

-- 1. Add hide_on_kitchen_close column to menu_categories if it does not exist
ALTER TABLE public.menu_categories 
ADD COLUMN IF NOT EXISTS hide_on_kitchen_close BOOLEAN DEFAULT false;

-- 2. By default, mark food/kitchen categories as hide_on_kitchen_close = true
-- (Excluding beverage, bar, coffee, tea, alcohol, drinks)
UPDATE public.menu_categories
SET hide_on_kitchen_close = true
WHERE LOWER(name) NOT LIKE '%coffee%' 
  AND LOWER(name) NOT LIKE '%tea%' 
  AND LOWER(name) NOT LIKE '%beverage%' 
  AND LOWER(name) NOT LIKE '%drink%' 
  AND LOWER(name) NOT LIKE '%soda%'
  AND LOWER(name) NOT LIKE '%beer%'
  AND LOWER(name) NOT LIKE '%cocktail%'
  AND LOWER(name) NOT LIKE '%mocktail%'
  AND LOWER(name) NOT LIKE '%alcohol%'
  AND LOWER(name) NOT LIKE '%ชา%'
  AND LOWER(name) NOT LIKE '%กาแฟ%'
  AND LOWER(name) NOT LIKE '%เครื่องดื่ม%'
  AND LOWER(name) NOT LIKE '%เบียร์%'
  AND LOWER(name) NOT LIKE '%เหล้า%';

-- 3. Insert default app_settings for QR Kitchen Cutoff
INSERT INTO public.app_settings (key, value)
VALUES 
    ('qr_kitchen_close_time', '22:00'),
    ('qr_kitchen_cutoff_enabled', 'true'),
    ('qr_kitchen_mode', 'auto'),
    ('qr_kitchen_closed_categories', '[]')
ON CONFLICT (key) DO NOTHING;

