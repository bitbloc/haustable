-- 1. Fix RLS policies on public.sop_categories
ALTER TABLE public.sop_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sop_categories_read" ON public.sop_categories;
CREATE POLICY "sop_categories_read" ON public.sop_categories
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sop_categories_write" ON public.sop_categories;
CREATE POLICY "sop_categories_write" ON public.sop_categories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Fix RLS policies on public.sop_recipes
ALTER TABLE public.sop_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sop_recipes_read" ON public.sop_recipes;
CREATE POLICY "sop_recipes_read" ON public.sop_recipes
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sop_recipes_write" ON public.sop_recipes;
CREATE POLICY "sop_recipes_write" ON public.sop_recipes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Fix RLS policies on public.sop_glass_sizes
ALTER TABLE public.sop_glass_sizes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sop_glass_sizes_read" ON public.sop_glass_sizes;
CREATE POLICY "sop_glass_sizes_read" ON public.sop_glass_sizes
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sop_glass_sizes_write" ON public.sop_glass_sizes;
CREATE POLICY "sop_glass_sizes_write" ON public.sop_glass_sizes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Grant SELECT permissions to anon (public) role
GRANT SELECT ON public.sop_categories TO anon;
GRANT SELECT ON public.sop_recipes TO anon;
GRANT SELECT ON public.sop_glass_sizes TO anon;

-- 5. Seed default Bar categories if not exists
INSERT INTO public.sop_categories (id, label, icon, department, sort_order) VALUES
    ('coffee_hot',    'Coffee',           '☕', 'bar', 1),
    ('iced_coffee',   'Iced Coffee',      '🧊', 'bar', 2),
    ('tea_matcha',    'Tea & Matcha',     '🍵', 'bar', 3),
    ('frappe',        'Frappe',           '🥤', 'bar', 4),
    ('signature',     'Signature Drinks', '🍸', 'bar', 5),
    ('mocktail',      'Mocktail',         '🍹', 'bar', 6),
    ('cocktail',      'Cocktail',         '🥃', 'bar', 7),
    ('base_prep',     'Base Prep',        '🧃', 'bar', 8)
ON CONFLICT (id) DO NOTHING;

-- 6. Seed default glass sizes if not exists
INSERT INTO public.sop_glass_sizes (label, size_oz, is_default, sort_order) VALUES
    ('8 oz (Hot)',     8,  false, 1),
    ('12 oz (Medium)', 12, false, 2),
    ('16 oz (Iced)',   16, true,  3),
    ('22 oz (Jumbo)',  22, false, 4)
ON CONFLICT DO NOTHING;
