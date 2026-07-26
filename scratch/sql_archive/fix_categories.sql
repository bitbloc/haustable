-- 1. Ensure 'Steak Pre-order' category exists in menu_categories
INSERT INTO public.menu_categories (name, display_order)
SELECT 'Steak Pre-order', 999
WHERE NOT EXISTS (
    SELECT 1 FROM public.menu_categories WHERE name = 'Steak Pre-order'
);

-- 2. Link 'Flat Iron ( นครศรีธรรมราช )' (and any other Steak Pre-order item) to the correct category ID
UPDATE public.menu_items
SET category_id = (SELECT id FROM public.menu_categories WHERE name = 'Steak Pre-order')
WHERE category = 'Steak Pre-order' AND category_id IS NULL;

-- 3. Resolve any other null category_id fields by matching the text category name
UPDATE public.menu_items mi
SET category_id = mc.id
FROM public.menu_categories mc
WHERE mi.category = mc.name AND mi.category_id IS NULL;

-- 4. Sync denormalized category string fields with the current menu_categories name where out of sync
-- This fixes items where the category name was renamed (e.g. 'ในชาม' -> 'จานเดียวรสชัด', 'ในบ้านเน้นกับ' -> 'กับข้าวถึงเครื่อง')
UPDATE public.menu_items mi
SET category = mc.name
FROM public.menu_categories mc
WHERE mi.category_id = mc.id AND mi.category IS DISTINCT FROM mc.name;
