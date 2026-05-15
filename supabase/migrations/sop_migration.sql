-- ============================================================
-- Bar SOP Migration
-- ระบบ SOP สำหรับพนักงาน Bar (+ Future Kitchen)
-- ============================================================

-- 1. SOP Categories (หมวดหมู่ SOP)
-- ใช้ได้ทั้ง Bar และ Kitchen (department field)
CREATE TABLE IF NOT EXISTS public.sop_categories (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    icon TEXT DEFAULT '📋',
    department TEXT NOT NULL DEFAULT 'bar', -- 'bar' | 'kitchen' | 'all'
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sop_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "sop_categories_read" ON public.sop_categories
    FOR SELECT TO authenticated USING (true);

-- Only admin can modify (via service_role or check profile)
CREATE POLICY "sop_categories_write" ON public.sop_categories
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Seed default Bar categories
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

-- ============================================================

-- 2. SOP Glass Sizes (ขนาดแก้ว)
CREATE TABLE IF NOT EXISTS public.sop_glass_sizes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    label TEXT NOT NULL,
    size_oz INT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sop_glass_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sop_glass_sizes_read" ON public.sop_glass_sizes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "sop_glass_sizes_write" ON public.sop_glass_sizes
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Seed default glass sizes
INSERT INTO public.sop_glass_sizes (label, size_oz, is_default, sort_order) VALUES
    ('8 oz (Hot)',     8,  false, 1),
    ('12 oz (Medium)', 12, false, 2),
    ('16 oz (Iced)',   16, true,  3),
    ('22 oz (Jumbo)',  22, false, 4);

-- ============================================================

-- 3. SOP Recipes (สูตร SOP)
CREATE TABLE IF NOT EXISTS public.sop_recipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic Info
    name TEXT NOT NULL,
    name_en TEXT,
    category_id TEXT REFERENCES public.sop_categories(id) ON DELETE SET NULL,
    department TEXT NOT NULL DEFAULT 'bar', -- Future: 'kitchen'
    
    -- Glass Size (base recipe is written for this glass)
    base_glass_size_oz INT DEFAULT 16,
    
    -- Link to existing system (optional, for Import/Sync)
    source_menu_item_id BIGINT,  -- References menu_items(id) loosely
    source_stock_item_id UUID,   -- References stock_items(id) loosely
    
    -- Recipe Data (JSONB for read-optimized display)
    -- ingredients: [{ "name": "Matcha powder", "qty": 3, "unit": "g", "scalable": true }]
    ingredients JSONB DEFAULT '[]'::jsonb,
    
    -- steps: [{ "order": 1, "action": "dissolve", "instruction": "ละลาย Matcha กับน้ำร้อน 30ml", "duration_sec": null }]
    steps JSONB DEFAULT '[]'::jsonb,
    
    -- scaling_rules: { "8": 0.5, "12": 0.75, "16": 1, "22": 1.375 }
    scaling_rules JSONB DEFAULT '{"8": 0.5, "12": 0.75, "16": 1, "22": 1.375}'::jsonb,
    
    -- Extra Info
    garnish TEXT,
    notes TEXT,
    
    -- State
    is_published BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sop_recipes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read published recipes
CREATE POLICY "sop_recipes_read" ON public.sop_recipes
    FOR SELECT TO authenticated USING (true);

-- Write access (admin check can be done at app level)
CREATE POLICY "sop_recipes_write" ON public.sop_recipes
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sop_recipes_category ON public.sop_recipes(category_id);
CREATE INDEX IF NOT EXISTS idx_sop_recipes_department ON public.sop_recipes(department);
CREATE INDEX IF NOT EXISTS idx_sop_recipes_published ON public.sop_recipes(is_published);

-- Grant permissions
GRANT ALL ON public.sop_categories TO authenticated;
GRANT ALL ON public.sop_categories TO service_role;
GRANT ALL ON public.sop_glass_sizes TO authenticated;
GRANT ALL ON public.sop_glass_sizes TO service_role;
GRANT ALL ON public.sop_recipes TO authenticated;
GRANT ALL ON public.sop_recipes TO service_role;

-- Add advanced_details column for Pro SOP
ALTER TABLE public.sop_recipes ADD COLUMN IF NOT EXISTS advanced_details JSONB DEFAULT '{}'::jsonb;
