-- sync_stock_item_type: put back the fix that was overwritten (audit 2026-11-24, finding 3)
--
-- 20261123150000 fixed this trigger; 20261123211000 (same day) replaced it with the older
-- body plus the portion-unit lines, which silently undid three things:
--   * a caller that only knows is_base_recipe (older builds, hand-written SQL) turned the
--     item into a hidden 'recipe' again, wiping its units and removing it from /staff/stock;
--   * editing conversion_factor on a prep was reverted to the old yield;
--   * updated_at was no longer refreshed.
-- This is the 15:00 body with the 21:10 portion-unit block added. Nothing else is new.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_stock_item_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Older callers only know is_base_recipe: treat as stocked prep, never hidden 'recipe'.
        IF NEW.item_type = 'raw' AND COALESCE(NEW.is_base_recipe, false) THEN
            NEW.item_type := 'prep';
        END IF;
    ELSIF NEW.item_type IS NOT DISTINCT FROM OLD.item_type
          AND NEW.is_base_recipe IS DISTINCT FROM OLD.is_base_recipe THEN
        -- Older callers toggled the homemade checkbox: switch between raw and stocked prep,
        -- never hidden 'recipe' (which wipes units and removes the item from /staff/stock).
        NEW.item_type := CASE WHEN COALESCE(NEW.is_base_recipe, false) THEN 'prep' ELSE 'raw' END;
    END IF;

    NEW.is_base_recipe := (NEW.item_type <> 'raw');

    IF NEW.item_type = 'prep' THEN
        NEW.prep_mode := COALESCE(NEW.prep_mode, 'stocked');

        -- A prep is counted in "สูตร": one spelling in the data (from 20261123211000).
        IF lower(COALESCE(NEW.unit, '')) IN ('portion', 'potion', 'สูตร')
           OR lower(COALESCE(NEW.pack_unit, '')) IN ('portion', 'potion', 'สูตร') THEN
            NEW.unit := 'portion';
            NEW.pack_unit := 'portion';
        END IF;

        IF TG_OP = 'UPDATE'
           AND NEW.portion_yield_qty IS NOT DISTINCT FROM OLD.portion_yield_qty
           AND NEW.conversion_factor IS DISTINCT FROM OLD.conversion_factor
           AND COALESCE(NEW.conversion_factor, 0) > 0 THEN
            -- Caller edited conversion_factor directly (e.g. StockItemForm): keep yield in sync.
            NEW.portion_yield_qty := round(NEW.conversion_factor::numeric, 4);
        ELSIF NEW.portion_yield_qty IS NULL AND COALESCE(NEW.conversion_factor, 0) > 1 THEN
            NEW.portion_yield_qty := round(NEW.conversion_factor::numeric, 4);
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

    IF TG_OP = 'UPDATE' AND NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
        NEW.updated_at := timezone('utc'::text, now());
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;
