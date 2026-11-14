-- ==============================================================================
-- Food & Drink structure: one recipe per menu, bases in folders, SOP = method
--
--   * Menu recipe (recipe_ingredients.parent_menu_item_id) is the only list of
--     what a dish / drink uses; it drives costing and stock deduction.
--   * Bases / preps (stock_items.item_type = 'prep') sit in recipe_folders,
--     stored in the database instead of the browser, and no longer take over
--     the stock category ('restock' / 'folder:...').
--   * Bar SOP keeps steps, glass and garnish, linked to a menu
--     (source_menu_item_id) or a base (source_stock_item_id). The app no longer
--     creates stock items from SOPs.
--
-- SOP repair: every SOP still pointed at stock items that were deleted. Those
-- links are cleared, then
--   - a SOP is linked to a base with the same name (เบส-ชาไทย = เบสชาไทย),
--   - a SOP is linked to a menu with the same name (after dropping prefixes such
--     as "Cocktail-", "Coffee - ") only when it is the one SOP for that menu,
--   - SOPs left unlinked keep their written ingredients as plain text lines.
-- A backup of every SOP is in backups/sop_before_food_drink_merge_20261115.json.
-- Safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Base folders
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipe_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_items
    ADD COLUMN IF NOT EXISTS recipe_folder_id UUID REFERENCES public.recipe_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stock_items_recipe_folder ON public.stock_items (recipe_folder_id) WHERE recipe_folder_id IS NOT NULL;

-- Folders that Recipe Lab kept in the stock category
INSERT INTO public.recipe_folders (name)
SELECT DISTINCT trim(substring(category FROM 8))
FROM public.stock_items
WHERE category LIKE 'folder:%' AND length(trim(substring(category FROM 8))) > 0
ON CONFLICT (name) DO NOTHING;

UPDATE public.stock_items si
SET recipe_folder_id = f.id
FROM public.recipe_folders f
WHERE si.category LIKE 'folder:%' AND trim(substring(si.category FROM 8)) = f.name
  AND si.recipe_folder_id IS NULL;

-- Made items back into a real stock category ("restock" is the low-stock group,
-- "folder:..." is not a category at all)
UPDATE public.stock_items
SET category = CASE WHEN EXISTS (SELECT 1 FROM public.stock_categories WHERE id = 'Homemade') THEN 'Homemade' ELSE 'other' END
WHERE COALESCE(item_type, 'raw') <> 'raw'
  AND (category = 'restock' OR category LIKE 'folder:%');

-- ------------------------------------------------------------------------------
-- 2. SOP links
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._fd_name_key(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT lower(regexp_replace(regexp_replace(COALESCE(p, ''), '\(.*?\)', '', 'g'), '[[:space:][:punct:]•]+', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION public._fd_sop_key(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT public._fd_name_key(regexp_replace(COALESCE(p, ''),
        '^\s*(oat\s+)?(hot\s+)?(soft\s*drink|coffe+|cocktail|mocktail)\s*-\s*', '', 'i'));
$$;

-- Links to stock items that no longer exist
UPDATE public.sop_recipes s
SET source_stock_item_id = NULL
WHERE source_stock_item_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.stock_items si WHERE si.id = s.source_stock_item_id);

-- Bases by name
UPDATE public.sop_recipes s
SET source_stock_item_id = b.id
FROM public.stock_items b
WHERE s.source_menu_item_id IS NULL AND s.source_stock_item_id IS NULL
  AND b.item_type = 'prep'
  AND public._fd_name_key(b.name) = public._fd_name_key(s.name)
  AND (SELECT count(*) FROM public.stock_items b2
       WHERE b2.item_type = 'prep' AND public._fd_name_key(b2.name) = public._fd_name_key(s.name)) = 1;

-- Menus by name, only when one SOP and one menu share the name
WITH cand AS (
    SELECT s.id AS sop_id, m.id AS menu_id
    FROM public.sop_recipes s
    JOIN public.menu_items m ON public._fd_name_key(m.name) = public._fd_sop_key(s.name)
    WHERE s.source_menu_item_id IS NULL AND s.source_stock_item_id IS NULL
      AND length(public._fd_sop_key(s.name)) > 1
),
single AS (
    SELECT sop_id, min(menu_id) AS menu_id
    FROM cand
    WHERE menu_id IN (SELECT menu_id FROM cand GROUP BY menu_id HAVING count(*) = 1)
    GROUP BY sop_id
    HAVING count(*) = 1
)
UPDATE public.sop_recipes s
SET source_menu_item_id = single.menu_id
FROM single
WHERE s.id = single.sop_id
  AND NOT EXISTS (SELECT 1 FROM public.sop_recipes o WHERE o.source_menu_item_id = single.menu_id AND o.id <> s.id);

-- Unlinked SOPs: their ingredient lines are text now (the app shows and keeps them)
UPDATE public.sop_recipes
SET ingredients = (
    SELECT COALESCE(jsonb_agg(e || '{"isLinked": false}'::jsonb), '[]'::jsonb)
    FROM jsonb_array_elements(ingredients) e
)
WHERE source_menu_item_id IS NULL AND source_stock_item_id IS NULL
  AND jsonb_typeof(ingredients) = 'array' AND jsonb_array_length(ingredients) > 0;

DROP FUNCTION public._fd_sop_key(TEXT);
DROP FUNCTION public._fd_name_key(TEXT);

-- ------------------------------------------------------------------------------
-- 3. Access
-- ------------------------------------------------------------------------------
ALTER TABLE public.recipe_folders ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        RETURN;
    END IF;
    DROP POLICY IF EXISTS recipe_folders_staff ON public.recipe_folders;
    CREATE POLICY recipe_folders_staff ON public.recipe_folders FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;

NOTIFY pgrst, 'reload schema';

-- Result
SELECT
    (SELECT count(*) FROM public.sop_recipes) AS sops,
    (SELECT count(*) FROM public.sop_recipes WHERE source_stock_item_id IS NOT NULL) AS linked_to_base,
    (SELECT count(*) FROM public.sop_recipes WHERE source_menu_item_id IS NOT NULL) AS linked_to_menu,
    (SELECT count(*) FROM public.sop_recipes WHERE source_menu_item_id IS NULL AND source_stock_item_id IS NULL) AS unlinked,
    (SELECT count(*) FROM public.recipe_folders) AS folders,
    (SELECT count(*) FROM public.stock_items WHERE COALESCE(item_type, 'raw') <> 'raw' AND category = 'restock') AS made_items_in_restock;
