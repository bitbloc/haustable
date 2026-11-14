-- ==============================================================================
-- Migration: Stock item types, portion yield and prep production
-- (Stock roadmap · Recipe Lab clean-up, runs after 20261113120000)
-- Date: 2026-11-13
--
-- Before this, is_base_recipe = true covered three different things that all sat
-- in the stock list: real prep (sauce / tea base), per-glass drink recipes created
-- by Bar SOP, and recipe templates. None of them recorded how much one making
-- of the recipe yields, so "1 unit" meant the whole portion and costs of anything
-- using a base came out wrong by orders of magnitude.
--
-- item_type
--   raw     bought, counted on the shelf
--   prep    made in-house from a recipe; one making = 1 portion, which yields
--           portion_yield_qty of usage_unit
--   recipe  a recipe only (per-glass drink, template); never held as stock
--
-- prep_mode (prep only)
--   stocked      "produce" moves raw stock into prep stock; sales deduct the prep
--   passthrough  never stocked; sales deduct straight through to its ingredients
--
-- Quantity rule (unchanged, now written down and relied on):
--   current_quantity is counted in pack_unit; 1 pack_unit = conversion_factor usage_unit.
--   For a prep: pack_unit = 'unit' (one portion), conversion_factor = portion_yield_qty.
--
-- Safe to re-run.
-- ==============================================================================

ALTER TABLE public.stock_items
    ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'raw',
    ADD COLUMN IF NOT EXISTS prep_mode TEXT,
    ADD COLUMN IF NOT EXISTS portion_yield_qty NUMERIC(14,4);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_items_item_type_check') THEN
        ALTER TABLE public.stock_items
            ADD CONSTRAINT stock_items_item_type_check CHECK (item_type IN ('raw', 'prep', 'recipe'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_items_prep_mode_check') THEN
        ALTER TABLE public.stock_items
            ADD CONSTRAINT stock_items_prep_mode_check CHECK (prep_mode IS NULL OR prep_mode IN ('stocked', 'passthrough'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_items_portion_yield_check') THEN
        ALTER TABLE public.stock_items
            ADD CONSTRAINT stock_items_portion_yield_check CHECK (portion_yield_qty IS NULL OR portion_yield_qty > 0);
    END IF;
END $$;

COMMENT ON COLUMN public.stock_items.item_type IS 'raw | prep | recipe';
COMMENT ON COLUMN public.stock_items.prep_mode IS 'prep only: stocked | passthrough';
COMMENT ON COLUMN public.stock_items.portion_yield_qty IS 'prep only: usage_unit produced by one portion (one making of the recipe). NULL = not measured yet';

CREATE INDEX IF NOT EXISTS idx_stock_items_item_type ON public.stock_items (item_type);

-- ------------------------------------------------------------------------------
-- Classify what is already there (only rows not classified yet)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_has_sop BOOLEAN := to_regclass('public.sop_recipes') IS NOT NULL;
    v_has_recipes BOOLEAN := to_regclass('public.recipe_ingredients') IS NOT NULL;
BEGIN
    -- Bar SOP keeps its bases in the "Based" folder.
    UPDATE public.stock_items
    SET item_type = 'prep'
    WHERE is_base_recipe AND item_type = 'raw' AND lower(category) IN ('folder:based', 'folder:base');

    -- Hand-made base formulas (not created by an SOP) that something else uses.
    IF v_has_recipes THEN
        IF v_has_sop THEN
            UPDATE public.stock_items si
            SET item_type = 'prep'
            WHERE si.is_base_recipe AND si.item_type = 'raw'
              AND EXISTS (SELECT 1 FROM public.recipe_ingredients r WHERE r.ingredient_id = si.id)
              AND NOT EXISTS (SELECT 1 FROM public.sop_recipes s WHERE s.source_stock_item_id = si.id);
        ELSE
            UPDATE public.stock_items si
            SET item_type = 'prep'
            WHERE si.is_base_recipe AND si.item_type = 'raw'
              AND EXISTS (SELECT 1 FROM public.recipe_ingredients r WHERE r.ingredient_id = si.id);
        END IF;
    END IF;

    -- Everything else flagged as a base recipe is a recipe, not something on a shelf.
    UPDATE public.stock_items SET item_type = 'recipe' WHERE is_base_recipe AND item_type = 'raw';

    UPDATE public.stock_items SET prep_mode = 'stocked' WHERE item_type = 'prep' AND prep_mode IS NULL;

    -- A prep whose "1 unit = N usage_unit" was already filled in has a known yield.
    UPDATE public.stock_items
    SET portion_yield_qty = round(conversion_factor::numeric, 4)
    WHERE item_type = 'prep' AND portion_yield_qty IS NULL
      AND COALESCE(pack_size, 1) = 1 AND COALESCE(conversion_factor, 1) > 1;
END $$;

-- Items created from the recipe screen were labelled with their recipe unit (g / ml)
-- although quantities are counted in the purchase unit. Only relabel rows with
-- nothing on hand, where the number cannot be misread; the rest need a person.
UPDATE public.stock_items
SET unit = pack_unit
WHERE item_type = 'raw'
  AND unit = usage_unit AND unit <> pack_unit
  AND COALESCE(current_quantity, 0) = 0
  AND pack_unit IS NOT NULL AND pack_unit <> '';

-- ------------------------------------------------------------------------------
-- Keep is_base_recipe (read by app builds already on devices) in step with item_type
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_stock_item_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Older builds only know is_base_recipe.
        IF NEW.item_type = 'raw' AND COALESCE(NEW.is_base_recipe, false) THEN
            NEW.item_type := 'recipe';
        END IF;
    ELSIF NEW.item_type IS NOT DISTINCT FROM OLD.item_type
          AND NEW.is_base_recipe IS DISTINCT FROM OLD.is_base_recipe THEN
        -- Older build toggled the checkbox.
        NEW.item_type := CASE WHEN COALESCE(NEW.is_base_recipe, false) THEN 'recipe' ELSE 'raw' END;
    END IF;

    NEW.is_base_recipe := (NEW.item_type <> 'raw');

    IF NEW.item_type = 'prep' THEN
        NEW.prep_mode := COALESCE(NEW.prep_mode, 'stocked');
        IF NEW.portion_yield_qty IS NOT NULL THEN
            -- One stock unit of a prep is one portion.
            NEW.pack_size := 1;
            NEW.conversion_factor := NEW.portion_yield_qty;
        END IF;
    ELSE
        NEW.prep_mode := NULL;
        NEW.portion_yield_qty := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stock_item_type ON public.stock_items;
CREATE TRIGGER trg_sync_stock_item_type
BEFORE INSERT OR UPDATE ON public.stock_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_stock_item_type();

-- ------------------------------------------------------------------------------
-- What does using p_usage_qty of an item take off the shelves?
-- Raw items and stocked preps are deducted themselves; recipes and passthrough
-- preps are followed down to their ingredients.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_recipe_requirements(
    p_item_id UUID,
    p_usage_qty NUMERIC,
    p_depth INT DEFAULT 0
)
RETURNS TABLE (stock_item_id UUID, stock_qty NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item public.stock_items%ROWTYPE;
    v_per_portion NUMERIC;
    r RECORD;
BEGIN
    IF p_depth > 8 THEN
        RAISE EXCEPTION 'stock_recipe_requirements: recipe nesting too deep (loop?) at item %', p_item_id;
    END IF;

    SELECT * INTO v_item FROM public.stock_items WHERE id = p_item_id;
    IF NOT FOUND OR p_usage_qty IS NULL OR p_usage_qty = 0 THEN
        RETURN;
    END IF;

    IF v_item.item_type = 'raw' OR (v_item.item_type = 'prep' AND v_item.prep_mode = 'stocked') THEN
        stock_item_id := v_item.id;
        stock_qty := p_usage_qty
            / NULLIF(COALESCE(NULLIF(v_item.conversion_factor, 0), 1)::numeric, 0)
            / (LEAST(GREATEST(COALESCE(v_item.yield_percent, 100), 1), 100)::numeric / 100);
        RETURN NEXT;
        RETURN;
    END IF;

    -- usage_unit made by one making of this recipe
    v_per_portion := COALESCE(NULLIF(v_item.pack_size, 0), 1)::numeric
                   * COALESCE(NULLIF(v_item.conversion_factor, 0), 1)::numeric;

    FOR r IN
        SELECT ri.ingredient_id, ri.quantity::numeric AS quantity
        FROM public.recipe_ingredients ri
        WHERE ri.parent_stock_item_id = v_item.id AND ri.ingredient_id IS NOT NULL
    LOOP
        RETURN QUERY
            SELECT * FROM public.stock_recipe_requirements(
                r.ingredient_id, r.quantity * p_usage_qty / v_per_portion, p_depth + 1);
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- Produce a stocked prep: ingredients out, prep in, one ledger reference.
-- p_portions      how many times the recipe was made
-- p_actual_yield  usage_unit actually obtained in total (optional; default = recipe yield)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.produce_prep(
    p_item_id UUID,
    p_portions NUMERIC,
    p_actual_yield NUMERIC DEFAULT NULL,
    p_performed_by TEXT DEFAULT 'Staff',
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item public.stock_items%ROWTYPE;
    v_ref TEXT := gen_random_uuid()::text;
    v_in NUMERIC;
    v_lines JSONB := '[]'::jsonb;
    r RECORD;
BEGIN
    IF p_portions IS NULL OR p_portions <= 0 THEN
        RAISE EXCEPTION 'produce_prep: portions must be greater than 0';
    END IF;

    SELECT * INTO v_item FROM public.stock_items WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'produce_prep: item % not found', p_item_id;
    END IF;
    IF v_item.item_type <> 'prep' OR v_item.prep_mode <> 'stocked' THEN
        RAISE EXCEPTION 'produce_prep: "%" is not a stocked prep', v_item.name;
    END IF;
    IF v_item.portion_yield_qty IS NULL THEN
        RAISE EXCEPTION 'produce_prep: "%" has no portion yield yet', v_item.name;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.recipe_ingredients WHERE parent_stock_item_id = p_item_id) THEN
        RAISE EXCEPTION 'produce_prep: "%" has no recipe', v_item.name;
    END IF;

    FOR r IN
        SELECT q.stock_item_id, SUM(q.stock_qty) AS stock_qty
        FROM public.recipe_ingredients ri
        CROSS JOIN LATERAL public.stock_recipe_requirements(ri.ingredient_id, ri.quantity::numeric * p_portions, 1) q
        WHERE ri.parent_stock_item_id = p_item_id AND ri.ingredient_id IS NOT NULL
        GROUP BY q.stock_item_id
        ORDER BY q.stock_item_id   -- stable lock order
    LOOP
        IF r.stock_item_id = p_item_id THEN
            RAISE EXCEPTION 'produce_prep: "%" uses itself as an ingredient', v_item.name;
        END IF;
        PERFORM public.post_stock_movement(r.stock_item_id, 'delta', -r.stock_qty, 'production_out',
                                           p_performed_by, COALESCE(p_note, 'ผลิต ' || v_item.name), 'production', v_ref);
        v_lines := v_lines || jsonb_build_object('stock_item_id', r.stock_item_id, 'quantity', round(-r.stock_qty, 4));
    END LOOP;

    v_in := CASE WHEN p_actual_yield IS NOT NULL AND p_actual_yield >= 0
                 THEN p_actual_yield / v_item.portion_yield_qty
                 ELSE p_portions END;

    PERFORM public.post_stock_movement(p_item_id, 'delta', v_in, 'production_in',
                                       p_performed_by, COALESCE(p_note, 'ผลิต ' || p_portions || ' portion'), 'production', v_ref);

    RETURN jsonb_build_object('success', true, 'production_id', v_ref, 'portions', p_portions,
                              'added', round(v_in, 4), 'ingredients', v_lines);
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        REVOKE ALL ON FUNCTION public.produce_prep(UUID, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
        GRANT EXECUTE ON FUNCTION public.produce_prep(UUID, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated, service_role;
        REVOKE ALL ON FUNCTION public.stock_recipe_requirements(UUID, NUMERIC, INT) FROM PUBLIC, anon;
        GRANT EXECUTE ON FUNCTION public.stock_recipe_requirements(UUID, NUMERIC, INT) TO authenticated, service_role;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
