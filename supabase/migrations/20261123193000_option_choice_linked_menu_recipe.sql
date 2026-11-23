-- ==============================================================================
-- Migration: Option choices can deduct an entire sold menu's recipe
--            (e.g., set meal drink pairing: จับคู่เครื่องดื่ม -> ชาไทย, อเมริกาโน่...)
-- Date: 2026-11-23
--
-- Why:
--   Many set menus include an option group such as "จับคู่เครื่องดื่ม" where the
--   customer picks a drink (อเมริกาโน่, ชาไทย, นมชมพู, แดงมะนาวโซดา, ชามะนาว, ชามะลิ)
--   that already exists in `menu_items` with its own full recipe.
--   Linking an option choice directly to `linked_menu_item_id` avoids duplicating
--   8–15 ingredient lines per choice and automatically stays in sync whenever the
--   drink's menu recipe is updated.
--
-- Changes:
--   1. `option_choice_ingredients.linked_menu_item_id`: references `menu_items(id)`.
--      `stock_item_id` becomes nullable; a check constraint ensures each row targets
--      either a `stock_item_id` OR a `linked_menu_item_id`.
--   2. Unique index `uq_option_choice_ingredients` covers both stock and menu targets.
--   3. `stock_requirements_for_sale`: when an option row has `linked_menu_item_id`,
--      explodes that menu's `recipe_ingredients` (honoring `order_scope` for
--      dine-in vs takeaway and `sweetener_factor` for sweetness).
--   4. Links the 6 choices of "จับคู่เครื่องดื่ม" to their corresponding drink menus
--      and rebuilds the 14-day sale stock shadow.
--
-- Apply this file alone:
--   npx supabase db query --remote --yes -f supabase/migrations/20261123193000_option_choice_linked_menu_recipe.sql
-- Safe to re-run.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Schema: linked_menu_item_id on option_choice_ingredients
-- ------------------------------------------------------------------------------
ALTER TABLE public.option_choice_ingredients
    ALTER COLUMN stock_item_id DROP NOT NULL;

ALTER TABLE public.option_choice_ingredients
    ADD COLUMN IF NOT EXISTS linked_menu_item_id BIGINT REFERENCES public.menu_items(id) ON DELETE CASCADE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'option_choice_ingredients_target_check'
    ) THEN
        ALTER TABLE public.option_choice_ingredients
            ADD CONSTRAINT option_choice_ingredients_target_check
            CHECK (
                (stock_item_id IS NOT NULL AND linked_menu_item_id IS NULL)
                OR (stock_item_id IS NULL AND linked_menu_item_id IS NOT NULL)
            );
    END IF;
END $$;

COMMENT ON COLUMN public.option_choice_ingredients.linked_menu_item_id IS
  'When set, choosing this option deducts `quantity` servings of that menu item''s recipe (parent_menu_item_id = linked_menu_item_id).';

DROP INDEX IF EXISTS public.uq_option_choice_ingredients;
CREATE UNIQUE INDEX uq_option_choice_ingredients
    ON public.option_choice_ingredients (
        choice_id,
        COALESCE(menu_item_id, (-1)::bigint),
        COALESCE(stock_item_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(linked_menu_item_id, (-1)::bigint)
    );

-- ------------------------------------------------------------------------------
-- 2. Update stock_requirements_for_sale to explode linked_menu_item_id recipes
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_requirements_for_sale(
    p_menu_item_id BIGINT,
    p_quantity NUMERIC,
    p_options JSONB,
    p_is_takeaway BOOLEAN DEFAULT false
)
RETURNS TABLE (stock_item_id UUID, source TEXT, stock_qty NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    rm RECORD;
    v_choice UUID;
    v_choices UUID[] := ARRAY[]::UUID[];
    v_has_specific BOOLEAN;
    v_factor NUMERIC := 1;
    v_f NUMERIC;
    v_takeaway BOOLEAN := COALESCE(p_is_takeaway, false);
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

    -- 1. Main menu recipe
    FOR r IN
        SELECT ri.ingredient_id,
               ri.quantity::numeric * CASE WHEN si.is_sweetener THEN v_factor ELSE 1 END AS quantity
        FROM public.recipe_ingredients ri
        JOIN public.stock_items si ON si.id = ri.ingredient_id
        WHERE ri.parent_menu_item_id = p_menu_item_id
          AND ri.ingredient_id IS NOT NULL
          AND (
              COALESCE(ri.order_scope, 'all') = 'all'
              OR (v_takeaway AND ri.order_scope = 'takeaway')
              OR (NOT v_takeaway AND ri.order_scope = 'dine_in')
          )
    LOOP
        RETURN QUERY
            SELECT q.stock_item_id, 'recipe'::text, q.stock_qty
            FROM public.stock_recipe_requirements(r.ingredient_id, r.quantity * p_quantity, 1) q;
    END LOOP;

    -- 2. Chosen options (direct stock items OR linked menu recipes)
    FOREACH v_choice IN ARRAY v_choices
    LOOP
        SELECT EXISTS (SELECT 1 FROM public.option_choice_ingredients
                       WHERE choice_id = v_choice AND menu_item_id = p_menu_item_id)
        INTO v_has_specific;

        FOR r IN
            SELECT oci.stock_item_id,
                   oci.linked_menu_item_id,
                   oci.quantity::numeric AS quantity
            FROM public.option_choice_ingredients oci
            WHERE oci.choice_id = v_choice
              AND (CASE WHEN v_has_specific THEN oci.menu_item_id = p_menu_item_id
                        ELSE oci.menu_item_id IS NULL END)
        LOOP
            IF r.stock_item_id IS NOT NULL THEN
                RETURN QUERY
                    SELECT q.stock_item_id, 'option'::text, q.stock_qty
                    FROM public.stock_items si
                    CROSS JOIN LATERAL public.stock_recipe_requirements(
                        r.stock_item_id,
                        r.quantity * CASE WHEN si.is_sweetener THEN v_factor ELSE 1 END * p_quantity,
                        1
                    ) q
                    WHERE si.id = r.stock_item_id;
            ELSIF r.linked_menu_item_id IS NOT NULL THEN
                FOR rm IN
                    SELECT ri.ingredient_id,
                           ri.quantity::numeric * CASE WHEN si.is_sweetener THEN v_factor ELSE 1 END AS quantity
                    FROM public.recipe_ingredients ri
                    JOIN public.stock_items si ON si.id = ri.ingredient_id
                    WHERE ri.parent_menu_item_id = r.linked_menu_item_id
                      AND ri.ingredient_id IS NOT NULL
                      AND (
                          COALESCE(ri.order_scope, 'all') = 'all'
                          OR (v_takeaway AND ri.order_scope = 'takeaway')
                          OR (NOT v_takeaway AND ri.order_scope = 'dine_in')
                      )
                LOOP
                    RETURN QUERY
                        SELECT q.stock_item_id, 'option'::text, q.stock_qty
                        FROM public.stock_recipe_requirements(
                            rm.ingredient_id,
                            rm.quantity * r.quantity * p_quantity,
                            1
                        ) q;
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Auto-link the 6 choices in "จับคู่เครื่องดื่ม" to their drink menus (1 serving each)
-- ------------------------------------------------------------------------------
INSERT INTO public.option_choice_ingredients (choice_id, menu_item_id, stock_item_id, linked_menu_item_id, quantity, unit)
SELECT v.choice_id::uuid, NULL, NULL, v.linked_menu_item_id, 1, 'menu'
FROM (VALUES
    ('99926459-4727-45d4-8b16-2bf52f48352f', 55::bigint),  -- อเมริกาโน่ -> อเมริกาโน่ (เย็น,ร้อน)
    ('8bab60a6-dee0-4e60-b989-c9b50c1bbc11', 67::bigint),  -- ชาไทย -> ชาไทย (ร้อน,เย็น)
    ('bbebe3b6-4858-487a-8cca-0adf9579c146', 127::bigint), -- นมชมพู -> นมชมพู
    ('61264676-0007-40bd-bdb3-b3eed5eab965', 125::bigint), -- แดงมะนาวโซดา -> แดงมะนาวโซดา
    ('a5ff6f47-cf97-45bf-81e5-130dc775ebcc', 150::bigint), -- ชามะนาว -> ชามะนาว
    ('8e26b06a-fdad-46af-908a-0082db362c41', 69::bigint)   -- ชามะลิ -> ชามะลิ (เย็น)
) AS v(choice_id, linked_menu_item_id)
WHERE EXISTS (SELECT 1 FROM public.option_choices oc WHERE oc.id = v.choice_id::uuid)
  AND EXISTS (SELECT 1 FROM public.menu_items mi WHERE mi.id = v.linked_menu_item_id)
ON CONFLICT (
    choice_id,
    COALESCE(menu_item_id, (-1)::bigint),
    COALESCE(stock_item_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(linked_menu_item_id, (-1)::bigint)
) DO UPDATE SET quantity = EXCLUDED.quantity, unit = EXCLUDED.unit;

-- Recompute shadow sales for the last 14 days
SELECT public.rebuild_sale_stock_shadow(now() - interval '14 days');

COMMIT;

NOTIFY pgrst, 'reload schema';
