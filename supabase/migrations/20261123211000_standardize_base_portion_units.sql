-- ==============================================================================
-- Standardize all in-house base / Homemade prep items to 'portion' ('สูตร')
--
-- Owner decision (2026-11-23):
--   All house-made bases / sauces / soups (item_type = 'prep' with category
--   'Homemade' or unit = 'portion') must consistently use 'portion' ('สูตร')
--   for both unit and pack_unit ("สูตร ต่อสูตร") instead of legacy pack_unit = 'unit'.
--
-- Keeps prep_mode = 'stocked' and does NOT alter stock_deduction_settings.mode
-- (remains 'shadow'). Safe to re-run.
-- ==============================================================================

UPDATE public.stock_items
SET unit = 'portion',
    pack_unit = 'portion',
    pack_size = 1
WHERE item_type = 'prep'
  AND (category = 'Homemade' OR lower(coalesce(unit, '')) IN ('portion', 'potion', 'สูตร'));

-- Ensure future prep items with unit = 'portion' keep pack_unit = 'portion' cleanly
CREATE OR REPLACE FUNCTION public.sync_stock_item_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.item_type = 'raw' AND COALESCE(NEW.is_base_recipe, false) THEN
            NEW.item_type := 'recipe';
        END IF;
    ELSIF NEW.item_type IS NOT DISTINCT FROM OLD.item_type
          AND NEW.is_base_recipe IS DISTINCT FROM OLD.is_base_recipe THEN
        NEW.item_type := CASE WHEN COALESCE(NEW.is_base_recipe, false) THEN 'recipe' ELSE 'raw' END;
    END IF;

    NEW.is_base_recipe := (NEW.item_type <> 'raw');

    IF NEW.item_type = 'prep' THEN
        NEW.prep_mode := COALESCE(NEW.prep_mode, 'stocked');
        IF lower(COALESCE(NEW.unit, '')) IN ('portion', 'potion', 'สูตร')
           OR lower(COALESCE(NEW.pack_unit, '')) IN ('portion', 'potion', 'สูตร') THEN
            NEW.unit := 'portion';
            NEW.pack_unit := 'portion';
        END IF;
        IF NEW.portion_yield_qty IS NOT NULL THEN
            NEW.pack_size := 1;
            NEW.conversion_factor := NEW.portion_yield_qty;
        END IF;
    ELSE
        NEW.prep_mode := NULL;
        NEW.portion_yield_qty := NULL;
        IF NEW.item_type = 'recipe' THEN
            -- One unit of a per-glass / per-dish recipe is one serving.
            NEW.pack_size := 1;
            NEW.conversion_factor := 1;
            NEW.yield_percent := 100;
            NEW.usage_unit := 'unit';
            NEW.pack_unit := 'unit';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
