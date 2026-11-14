-- ==============================================================================
-- Recipe versions (roadmap C4)
--
-- Every save of a menu or base recipe in the recipe editor stores a snapshot
-- (rows with ingredient names, quantity, unit; cost at that time; who saved).
-- The editor's "ประวัติ" window lists them, shows what changed between saves
-- and can load an old version back into the editor.
--
-- The app writes a version only after the save itself succeeded, and skips a
-- save that changed nothing. Safe to re-run.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.recipe_versions (
    id BIGSERIAL PRIMARY KEY,
    parent_menu_item_id BIGINT,
    parent_stock_item_id UUID,
    rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_cost NUMERIC(14,2),
    saved_by TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((parent_menu_item_id IS NULL) <> (parent_stock_item_id IS NULL))
);

DO $$
BEGIN
    IF to_regclass('public.menu_items') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_versions_menu_fk') THEN
        ALTER TABLE public.recipe_versions ADD CONSTRAINT recipe_versions_menu_fk
            FOREIGN KEY (parent_menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recipe_versions_stock_fk') THEN
        ALTER TABLE public.recipe_versions ADD CONSTRAINT recipe_versions_stock_fk
            FOREIGN KEY (parent_stock_item_id) REFERENCES public.stock_items(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recipe_versions_menu ON public.recipe_versions (parent_menu_item_id, created_at DESC) WHERE parent_menu_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recipe_versions_stock ON public.recipe_versions (parent_stock_item_id, created_at DESC) WHERE parent_stock_item_id IS NOT NULL;

COMMENT ON TABLE public.recipe_versions IS 'Snapshot of a menu / base recipe at each save: rows (name, quantity, unit), cost, who.';

ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        RETURN;
    END IF;
    -- Read and add only: history is not edited or deleted from the app.
    DROP POLICY IF EXISTS recipe_versions_read ON public.recipe_versions;
    CREATE POLICY recipe_versions_read ON public.recipe_versions FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS recipe_versions_insert ON public.recipe_versions;
    CREATE POLICY recipe_versions_insert ON public.recipe_versions FOR INSERT TO authenticated WITH CHECK (true);
END $$;

NOTIFY pgrst, 'reload schema';
