-- ==============================================================================
-- Migration: Prevent StockItemForm is_base_recipe edits from hiding items as
--            'recipe', keep updated_at accurate, and use 'สูตร' instead of
--            'portion' in production notes and unit normalization.
-- Date: 2026-11-23
--
-- Root cause found in live audit (2026-11-23):
--   StockItemForm.jsx toggled is_base_recipe without sending item_type.
--   sync_stock_item_type() mapped legacy is_base_recipe=true -> item_type='recipe',
--   which then wiped pack_size, conversion_factor, yield_percent, usage_unit and
--   pack_unit to 1 / 1 / 100 / 'unit' / 'unit' AND caused StockPage / StockCountPage /
--   StockReceivePage to immediately hide the item (isShelfItem = item_type !== 'recipe').
--
-- Fixes:
--   1. sync_stock_item_type():
--      - Legacy is_base_recipe=true without explicit item_type='recipe' maps to
--        item_type='prep' (prep_mode='stocked'), never 'recipe'.
--      - Preserves conversion_factor into portion_yield_qty when transitioning
--        raw -> prep or when conversion_factor is edited on a prep item.
--      - Automatically refreshes updated_at on UPDATE when not explicitly set.
--   2. produce_prep():
--      - Default ledger note uses 'สูตร' instead of 'portion'.
--   3. stock_unit_code():
--      - Maps 'portion', 'potion', and 'สูตร' to 'portion'.
--
-- Apply this file alone:
--   npx supabase db query --remote --yes -f supabase/migrations/20261123150000_fix_stock_item_type_trigger_and_portion_label.sql
-- Safe to re-run.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.stock_unit_code(p_unit TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(m.code, lower(trim(COALESCE(p_unit, '')))) FROM (SELECT 1) one
    LEFT JOIN (VALUES
        ('g', 'g'), ('กรัม', 'g'), ('ก.', 'g'), ('kg', 'kg'), ('กก.', 'kg'), ('กก', 'kg'), ('กิโลกรัม', 'kg'),
        ('mg', 'mg'), ('ขีด', 'ขีด'),
        ('ml', 'ml'), ('มล.', 'ml'), ('มล', 'ml'), ('มิลลิลิตร', 'ml'), ('l', 'l'), ('ลิตร', 'l'), ('ล.', 'l'),
        ('gallon', 'gallon'), ('แกลลอน', 'gallon'), ('แกลอน', 'gallon'),
        ('bottle', 'bottle'), ('ขวด', 'bottle'), ('can', 'can'), ('กระป๋อง', 'can'),
        ('pcs', 'pcs'), ('piece', 'pcs'), ('ชิ้น', 'pcs'),
        ('pack', 'pack'), ('แพ็ค', 'pack'), ('แพค', 'pack'), ('crate', 'crate'), ('ลัง', 'crate'),
        ('box', 'box'), ('กล่อง', 'box'), ('bag', 'bag'), ('ถุง', 'bag'), ('glass', 'glass'), ('แก้ว', 'glass'),
        ('portion', 'portion'), ('potion', 'portion'), ('สูตร', 'portion')
    ) AS m(name, code) ON m.name = lower(trim(COALESCE(p_unit, '')));
$$;

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

CREATE OR REPLACE FUNCTION public.produce_prep(
    p_item_id uuid,
    p_portions numeric,
    p_actual_yield numeric DEFAULT NULL::numeric,
    p_performed_by text DEFAULT 'Staff'::text,
    p_note text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
                                       p_performed_by, COALESCE(p_note, 'ผลิต ' || p_portions || ' สูตร'), 'production', v_ref);

    RETURN jsonb_build_object('success', true, 'production_id', v_ref, 'portions', p_portions,
                              'added', round(v_in, 4), 'ingredients', v_lines);
END;
$function$;

COMMIT;

NOTIFY pgrst, 'reload schema';
