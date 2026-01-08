-- Ensure columns exist
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_sold_out boolean DEFAULT false;
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS display_order int DEFAULT 0;

-- Create 'Steak Pre-order' Category
INSERT INTO menu_categories (name, is_hidden, display_order)
SELECT 'Steak Pre-order', true, 999
WHERE NOT EXISTS (SELECT 1 FROM menu_categories WHERE name = 'Steak Pre-order');

-- Create 'Doneness' Option Group
INSERT INTO option_groups (name, selection_type, is_required, min_selection, max_selection)
SELECT 'Doneness', 'single', true, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM option_groups WHERE name = 'Doneness');

-- Get IDs (Use DO block )
DO $$
DECLARE
    cat_id uuid;
    opt_group_id uuid;
BEGIN
    SELECT id INTO cat_id FROM menu_categories WHERE name = 'Steak Pre-order';
    SELECT id INTO opt_group_id FROM option_groups WHERE name = 'Doneness';

    -- Insert Default Steaks (Wagyu A5, T-Bone, Ribeye)
    IF cat_id IS NOT NULL THEN
        INSERT INTO menu_items (category, name, description, price, image_url, is_recommended, is_sold_out)
        SELECT 'Steak Pre-order', 'Wagyu A5 (Miyazaki)', 'Premium Japanese Wagyu, melt in your mouth.', 3500, 'https://images.unsplash.com/photo-1546833999-b9f581602809?auto=format&fit=crop&q=80&w=800', true, false
        WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = 'Wagyu A5 (Miyazaki)' AND category = 'Steak Pre-order');

        INSERT INTO menu_items (category, name, description, price, image_url, is_recommended, is_sold_out)
        SELECT 'Steak Pre-order', 'US Prime Ribeye', 'Intense marbling, rich flavor.', 2200, 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&q=80&w=800', false, false
        WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = 'US Prime Ribeye' AND category = 'Steak Pre-order');
        
        INSERT INTO menu_items (category, name, description, price, image_url, is_recommended, is_sold_out)
        SELECT 'Steak Pre-order', 'T-Bone Steak', 'The best of both worlds (Sirloin & Tenderloin).', 2800, 'https://images.unsplash.com/photo-1594041680534-e8c8cdebd659?auto=format&fit=crop&q=80&w=800', false, false
        WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name = 'T-Bone Steak' AND category = 'Steak Pre-order');
    END IF;

    -- Insert Doneness Options
    IF opt_group_id IS NOT NULL THEN
        INSERT INTO option_choices (group_id, name, price_modifier) SELECT opt_group_id, 'Blue Rare', 0 WHERE NOT EXISTS (SELECT 1 FROM option_choices WHERE group_id = opt_group_id AND name = 'Blue Rare');
        INSERT INTO option_choices (group_id, name, price_modifier) SELECT opt_group_id, 'Rare', 0 WHERE NOT EXISTS (SELECT 1 FROM option_choices WHERE group_id = opt_group_id AND name = 'Rare');
        INSERT INTO option_choices (group_id, name, price_modifier) SELECT opt_group_id, 'Medium Rare', 0 WHERE NOT EXISTS (SELECT 1 FROM option_choices WHERE group_id = opt_group_id AND name = 'Medium Rare');
        INSERT INTO option_choices (group_id, name, price_modifier) SELECT opt_group_id, 'Medium', 0 WHERE NOT EXISTS (SELECT 1 FROM option_choices WHERE group_id = opt_group_id AND name = 'Medium');
        INSERT INTO option_choices (group_id, name, price_modifier) SELECT opt_group_id, 'Medium Well', 0 WHERE NOT EXISTS (SELECT 1 FROM option_choices WHERE group_id = opt_group_id AND name = 'Medium Well');
        INSERT INTO option_choices (group_id, name, price_modifier) SELECT opt_group_id, 'Well Done', 0 WHERE NOT EXISTS (SELECT 1 FROM option_choices WHERE group_id = opt_group_id AND name = 'Well Done');
    END IF;

    -- Link Steaks to Doneness (Menu Item Options)
    INSERT INTO menu_item_options (menu_item_id, option_group_id)
    SELECT mi.id, opt_group_id
    FROM menu_items mi
    WHERE mi.category = 'Steak Pre-order'
    AND NOT EXISTS (SELECT 1 FROM menu_item_options mio WHERE mio.menu_item_id = mi.id AND mio.option_group_id = opt_group_id);

END $$;
