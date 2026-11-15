-- ROLLBACK for supabase/migrations/20261116180000_sweetness_scaling.sql
-- Puts stock_requirements_for_sale back to its 20261114120000 definition (no sweetness
-- scaling). The two new columns are left in place (harmless) so the admin keeps the values.
BEGIN;
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
    v_has_specific BOOLEAN;
BEGIN
    IF p_menu_item_id IS NULL OR COALESCE(p_quantity, 0) = 0 THEN
        RETURN;
    END IF;

    FOR r IN
        SELECT ri.ingredient_id, ri.quantity::numeric AS quantity
        FROM public.recipe_ingredients ri
        WHERE ri.parent_menu_item_id = p_menu_item_id AND ri.ingredient_id IS NOT NULL
    LOOP
        RETURN QUERY
            SELECT q.stock_item_id, 'recipe'::text, q.stock_qty
            FROM public.stock_recipe_requirements(r.ingredient_id, r.quantity * p_quantity, 1) q;
    END LOOP;

    IF p_options IS NULL OR jsonb_typeof(p_options) <> 'array' THEN
        RETURN;
    END IF;

    FOR v_choice IN
        SELECT DISTINCT (o->>'choice_id')::uuid
        FROM jsonb_array_elements(p_options) o
        WHERE jsonb_typeof(o) = 'object'
          AND (o->>'choice_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LOOP
        SELECT EXISTS (SELECT 1 FROM public.option_choice_ingredients
                       WHERE choice_id = v_choice AND menu_item_id = p_menu_item_id)
        INTO v_has_specific;

        FOR r IN
            SELECT oci.stock_item_id AS ingredient_id, oci.quantity
            FROM public.option_choice_ingredients oci
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
COMMIT;
