-- 1. Modify stock_items table to support Costing & Unit Conversion
-- Note: Requires no changes to IDs
ALTER TABLE stock_items 
ADD COLUMN IF NOT EXISTS cost_price float DEFAULT 0,    -- ราคาซื้อ (บาท)
ADD COLUMN IF NOT EXISTS pack_size float DEFAULT 1,     -- ปริมาณที่ซื้อ (เช่น 1000)
ADD COLUMN IF NOT EXISTS pack_unit text DEFAULT 'unit', -- หน่วยที่ซื้อ (เช่น 'g', 'ml', 'bag')
ADD COLUMN IF NOT EXISTS usage_unit text DEFAULT 'unit',-- หน่วยที่ใช้ในสูตร (เช่น 'g', 'ml')
ADD COLUMN IF NOT EXISTS conversion_factor float DEFAULT 1, -- ตัวคูณแปลงหน่วย (1 pack_unit = X usage_unit)
ADD COLUMN IF NOT EXISTS yield_percent float DEFAULT 100, -- % Yield (เนื้อจริงที่ใช้ได้)
ADD COLUMN IF NOT EXISTS is_base_recipe boolean DEFAULT false; -- เป็นสูตรตั้งต้นหรือไม่ (Base Recipe)

-- 2. Modify menu_items table for Pricing Logic
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS q_factor_percent float DEFAULT 0; -- % เผื่อเสีย (Hidden Cost)

-- 3. Create recipe_ingredients table (The "Linker" table)
-- IMPORTANT: "parent_menu_item_id" must match menu_items.id type (bigint)
-- IF stock_items.id is also bigint, change "uuid" to "bigint" below for parent_stock_item_id and ingredient_id.
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    
    -- Parent can be a Menu Item (Main Recipe) OR a Stock Item (Base Recipe)
    parent_menu_item_id bigint REFERENCES menu_items(id) ON DELETE CASCADE,
    parent_stock_item_id uuid REFERENCES stock_items(id) ON DELETE CASCADE,
    
    -- The Ingredient
    ingredient_id uuid REFERENCES stock_items(id) ON DELETE RESTRICT,
    
    quantity float NOT NULL, -- ปริมาณที่ใช้
    unit text,               -- หน่วยที่บันทึก
    layer_order int DEFAULT 0, -- For Visual Layering
    
    -- Constraint: Must have exactly one parent
    CONSTRAINT one_parent_check CHECK (
        (parent_menu_item_id IS NOT NULL AND parent_stock_item_id IS NULL) OR
        (parent_menu_item_id IS NULL AND parent_stock_item_id IS NOT NULL)
    )
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_recipe_menu_parent ON recipe_ingredients(parent_menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_stock_parent ON recipe_ingredients(parent_stock_item_id);

-- 4. Enable RLS (Security)
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON recipe_ingredients
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
