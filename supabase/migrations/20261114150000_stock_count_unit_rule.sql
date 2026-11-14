-- ==============================================================================
-- Migration: One rule for "how much recipe quantity is one counted unit"
-- (Stock roadmap · fixes shadow deduction, runs after 20261114120000)
-- Date: 2026-11-14
--
-- Found by shadow mode on day one: soda is counted in bottles but set up as
-- "buy 325 ml, 1 ml per unit", so 150 ml in a drink was read as 150 bottles.
-- Costing already treated one pack as pack_size x conversion_factor and was right;
-- only the stock conversion was wrong.
--
-- Rule (also in src/utils/recipeGraph.js usagePerStockUnit):
--   pack_unit is a weight or volume AND the count unit differs from it
--       -> one counted unit is the whole pack = pack_size x conversion_factor
--          (soda: bottle = 325 ml; Aro gallon = 6 l = 6000 ml)
--   otherwise (pack is a count of pieces, or counted in the pack unit itself)
--       -> one counted unit = conversion_factor
--          (coke: case of 12 bottles, counted per bottle = 1 bottle;
--           pork belly counted in kg = 1000 g)
--
-- Real stock is not touched. Shadow rows for the last 14 days are rebuilt.
-- Safe to re-run.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.stock_usage_per_count_unit(p_item public.stock_items)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN lower(COALESCE(p_item.pack_unit, '')) IN
                 ('ml', 'l', 'g', 'kg', 'mg', 'oz', 'oz_fl', 'lb', 'gallon', 'ขีด', 'cup', 'tbsp', 'tsp', 'shot')
             AND lower(COALESCE(p_item.unit, '')) <> lower(COALESCE(p_item.pack_unit, ''))
             AND COALESCE(p_item.pack_size, 0) > 0
        THEN p_item.pack_size::numeric * COALESCE(NULLIF(p_item.conversion_factor, 0), 1)::numeric
        ELSE COALESCE(NULLIF(p_item.conversion_factor, 0), 1)::numeric
    END;
$$;

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
            / NULLIF(CASE WHEN v_item.item_type = 'prep' THEN COALESCE(NULLIF(v_item.conversion_factor, 0), 1)::numeric
                          ELSE public.stock_usage_per_count_unit(v_item) END, 0)
            / (LEAST(GREATEST(COALESCE(v_item.yield_percent, 100), 1), 100)::numeric / 100);
        RETURN NEXT;
        RETURN;
    END IF;

    IF v_item.item_type = 'recipe' THEN
        v_per_portion := 1;
    ELSE
        v_per_portion := COALESCE(NULLIF(v_item.portion_yield_qty, 0),
                                  COALESCE(NULLIF(v_item.pack_size, 0), 1)::numeric
                                * COALESCE(NULLIF(v_item.conversion_factor, 0), 1)::numeric);
    END IF;

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

SELECT public.rebuild_sale_stock_shadow(now() - interval '14 days');

NOTIFY pgrst, 'reload schema';
