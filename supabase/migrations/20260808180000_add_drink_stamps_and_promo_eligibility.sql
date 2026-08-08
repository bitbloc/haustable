-- Migration: Add Drink Stamp Tracking & Eligibility Columns
-- Description: Adds columns for Drink 10 Free 1 punchcard system to profiles, menu_items, and menu_categories

-- 1. Add stamp tracking fields to public.profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS drink_stamp_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_drink_quota INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_drinks_purchased INT DEFAULT 0;

-- 2. Add eligibility flag to public.menu_items
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS is_drink_stamp_eligible BOOLEAN DEFAULT false;

-- 3. Add eligibility flag to public.menu_categories
ALTER TABLE public.menu_categories 
ADD COLUMN IF NOT EXISTS is_drink_stamp_eligible BOOLEAN DEFAULT false;

-- 4. Set initial default eligibility for beverage categories (e.g. Coffee, Tea, Beverage, Drink, Drinks, Soda)
UPDATE public.menu_categories 
SET is_drink_stamp_eligible = true 
WHERE LOWER(name) LIKE '%coffee%' 
   OR LOWER(name) LIKE '%tea%' 
   OR LOWER(name) LIKE '%beverage%' 
   OR LOWER(name) LIKE '%drink%' 
   OR LOWER(name) LIKE '%soda%'
   OR LOWER(name) LIKE '%ชา%'
   OR LOWER(name) LIKE '%กาแฟ%'
   OR LOWER(name) LIKE '%เครื่องดื่ม%';

-- Automatically mark existing menu items under eligible categories as eligible
UPDATE public.menu_items mi
SET is_drink_stamp_eligible = true
FROM public.menu_categories mc
WHERE mi.category_id = mc.id AND mc.is_drink_stamp_eligible = true;
