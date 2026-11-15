-- ==============================================================================
-- Sweetness levels scale the sweetener in stock calculations
-- Date: 2026-11-16 · Apply in the Supabase SQL Editor
-- Rollback: supabase/security_hardening/03_sweetness_scaling_ROLLBACK.sql
-- APPLIED to production on 2026-11-16 via the SQL Editor. Verified: 4 sweetness choices got
-- 0 / 0.5 / 1 / 1.2, 7 base sweeteners marked; "คักอีหลี" sugar 0.070 normal, 0.035 less sweet,
-- none for no sugar, other ingredients unchanged.
--
-- Hot/iced and other options add or remove fixed amounts (option_choice_ingredients).
-- Sweetness is different: "less sweet" means half of whatever sweetener this drink
-- uses, which differs per menu and between hot and iced. So:
--   * stock_items.is_sweetener   marks syrup, sugar, condensed milk, honey...
--   * option_choices.sweetener_factor   0 = none, 0.5 = half, 1 = normal, 1.2 = extra
--   * stock_requirements_for_sale multiplies every sweetener line of the sale (from the
--     menu recipe and from other options such as "iced") by the chosen factor.
--     Several factors multiply. Lines that are not sweeteners are untouched.
-- Same multipliers the SOP sweetness view already uses (useBarSOP defaults).
-- Stock deduction is still in shadow mode: this changes what is recorded, not real stock.
-- ==============================================================================

BEGIN;

ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS is_sweetener BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.stock_items.is_sweetener IS
  'Scaled by the sweetness option of a sale (option_choices.sweetener_factor).';

ALTER TABLE public.option_choices ADD COLUMN IF NOT EXISTS sweetener_factor NUMERIC(6,3);
DO $$ BEGIN
    ALTER TABLE public.option_choices
        ADD CONSTRAINT option_choices_sweetener_factor_range CHECK (sweetener_factor IS NULL OR (sweetener_factor >= 0 AND sweetener_factor <= 5));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
COMMENT ON COLUMN public.option_choices.sweetener_factor IS
  'NULL = no effect. Otherwise multiplies the sweetener lines of the sale: 0 none, 0.5 half, 1 normal, 1.2 extra.';

CREATE OR REPLACE FUNCTION public.stock_requirements_for_sale(
    p_menu_item_id BIGINT,
    p_quantity NUMERIC,
    p_options JSONB
)
RETURNS TABLE (stock_item_id UUID, source TEXT, stock_qty NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_choice UUID;
    v_choices UUID[] := ARRAY[]::UUID[];
    v_has_specific BOOLEAN;
    v_factor NUMERIC := 1;
    v_f NUMERIC;
BEGIN
    IF p_menu_item_id IS NULL OR COALESCE(p_quantity, 0) = 0 THEN
        RETURN;
    END IF;

    -- Chosen option ids (only entries carrying a real choice_id count)
    IF p_options IS NOT NULL AND jsonb_typeof(p_options) = 'array' THEN
        SELECT COALESCE(array_agg(DISTINCT (o->>'choice_id')::uuid), ARRAY[]::UUID[]) INTO v_choices
        FROM jsonb_array_elements(p_options) o
        WHERE jsonb_typeof(o) = 'object'
          AND (o->>'choice_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    END IF;

    -- Sweetness multiplier: product of every chosen choice that has one
    FOR v_f IN
        SELECT oc.sweetener_factor FROM public.option_choices oc
        WHERE oc.id = ANY (v_choices) AND oc.sweetener_factor IS NOT NULL
    LOOP
        v_factor := v_factor * v_f;
    END LOOP;

    FOR r IN
        SELECT ri.ingredient_id,
               ri.quantity::numeric * CASE WHEN si.is_sweetener THEN v_factor ELSE 1 END AS quantity
        FROM public.recipe_ingredients ri
        JOIN public.stock_items si ON si.id = ri.ingredient_id
        WHERE ri.parent_menu_item_id = p_menu_item_id AND ri.ingredient_id IS NOT NULL
    LOOP
        RETURN QUERY
            SELECT q.stock_item_id, 'recipe'::text, q.stock_qty
            FROM public.stock_recipe_requirements(r.ingredient_id, r.quantity * p_quantity, 1) q;
    END LOOP;

    FOREACH v_choice IN ARRAY v_choices
    LOOP
        SELECT EXISTS (SELECT 1 FROM public.option_choice_ingredients
                       WHERE choice_id = v_choice AND menu_item_id = p_menu_item_id)
        INTO v_has_specific;

        FOR r IN
            SELECT oci.stock_item_id AS ingredient_id,
                   oci.quantity * CASE WHEN si.is_sweetener THEN v_factor ELSE 1 END AS quantity
            FROM public.option_choice_ingredients oci
            JOIN public.stock_items si ON si.id = oci.stock_item_id
            WHERE oci.choice_id = v_choice
              AND (CASE WHEN v_has_specific THEN oci.menu_item_id = p_menu_item_id
                        ELSE oci.menu_item_id IS NULL END)
        LOOP
            RETURN QUERY
                SELECT q.stock_item_id, 'option'::text, q.stock_qty
                FROM public.stock_recipe_requirements(r.ingredient_id, r.quantity * p_quantity, 1) q;
        END LOOP;
    END LOOP;
END;
$$;

-- Starting values, only where nothing is set yet (the owner can change them in the admin)
UPDATE public.option_choices SET sweetener_factor = CASE
        WHEN name ILIKE 'ไม่หวาน%'  THEN 0
        WHEN name ILIKE 'หวานน้อย%' THEN 0.5
        WHEN name ILIKE 'หวานปกติ%' THEN 1
        WHEN name ILIKE 'หวานมาก%'  THEN 1.2
    END
WHERE sweetener_factor IS NULL
  AND (name ILIKE 'ไม่หวาน%' OR name ILIKE 'หวานน้อย%' OR name ILIKE 'หวานปกติ%' OR name ILIKE 'หวานมาก%');

-- Base sweeteners. Flavour syrups (mint, strawberry, lychee...) are left unmarked: "less sweet"
-- usually keeps the flavour and cuts the plain sweetener. Change either in the admin.
UPDATE public.stock_items SET is_sweetener = true
WHERE is_sweetener = false
  AND item_type = 'raw'
  AND (name ILIKE 'น้ำตาล%' OR name ILIKE 'นมข้นหวาน%' OR name ILIKE 'น้ำผึ้ง%'
       OR name ILIKE 'ไซรัป มิตรผล%');

COMMIT;

-- Check (read-only):
--   SELECT name, sweetener_factor FROM option_choices WHERE sweetener_factor IS NOT NULL;
--   SELECT name FROM stock_items WHERE is_sweetener;
