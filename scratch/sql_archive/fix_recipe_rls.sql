-- Enable RLS
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

-- 1. DROP Existing Policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON recipe_ingredients;
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON stock_items;
-- Also drop potential 'anon' policies if I named them differently before (good practice)
DROP POLICY IF EXISTS "Enable all access for public" ON recipe_ingredients;
DROP POLICY IF EXISTS "Enable all access for public" ON stock_items;

-- 2. CREATE New Policies (OPEN TO ALL - PUBLIC/ANON INCLUDED)
-- This is for debugging to confirm if 'authenticated' role was the blocker.
CREATE POLICY "Enable all access for public" ON recipe_ingredients
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable all access for public" ON stock_items
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Grant permissions
GRANT ALL ON recipe_ingredients TO authenticated;
GRANT ALL ON recipe_ingredients TO service_role;
GRANT ALL ON recipe_ingredients TO anon; -- Grant to public

GRANT ALL ON stock_items TO authenticated;
GRANT ALL ON stock_items TO service_role;
GRANT ALL ON stock_items TO anon; -- Grant to public
