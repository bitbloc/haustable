-- ==============================================================================
-- Migration: Per-ingredient order scope (all / dine_in / takeaway) for automatic
--            packaging and channel-specific stock deduction
-- Date: 2026-11-23
--
-- Why:
--   A dish eaten in the restaurant uses ceramic plates, while a pickup / takeaway
--   or delivery order (booking_type = 'pickup', order_type = 'hausmade_pickup',
--   source = 'lineman', or order_items.channel = 'pickup') consumes takeaway
--   boxes, soup bags, rubber bands, and plastic cutlery.
--
--   Adding `order_scope` ('all' | 'dine_in' | 'takeaway') on `recipe_ingredients`
--   lets staff configure takeaway packaging directly on each menu recipe in the
--   back-office Recipe Builder, and automatically deducts packaging ONLY when
--   the bill is a takeaway / pickup / delivery order.
--
-- Changes:
--   1. `recipe_ingredients.order_scope`: 'all' (default), 'dine_in', 'takeaway'.
--   2. `save_menu_recipe`: persists `order_scope` from the Recipe Builder.
--   3. `is_takeaway_sale(p_booking_id, p_channel)`: determines whether an order
--      line is takeaway/pickup/delivery vs dine-in.
--   4. `stock_requirements_for_sale(..., p_is_takeaway)`: filters menu recipe
--      ingredients by `order_scope` and tags takeaway-only lines as source
--      'packaging' (or 'recipe' within the existing check constraint).
--   5. `record_sale_stock_shadow`, `trg_fn_order_item_stock_shadow`, and
--      `rebuild_sale_stock_shadow`: automatically pass takeaway state and
--      recompute when a booking's `booking_type` or `table_id` changes.
--
-- Apply this file alone:
--   npx supabase db query --remote --yes -f supabase/migrations/20261123183000_recipe_order_scope_takeaway_packaging.sql
-- Safe to re-run.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Column: recipe_ingredients.order_scope
-- ------------------------------------------------------------------------------
ALTER TABLE public.recipe_ingredients
    ADD COLUMN IF NOT EXISTS order_scope TEXT NOT NULL DEFAULT 'all';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'recipe_ingredients_order_scope_check'
    ) THEN
        ALTER TABLE public.recipe_ingredients
            ADD CONSTRAINT recipe_ingredients_order_scope_check
            CHECK (order_scope IN ('all', 'dine_in', 'takeaway'));
    END IF;
END $$;

COMMENT ON COLUMN public.recipe_ingredients.order_scope IS
  'all = deducted on every sale; dine_in = deducted only on dine-in orders; takeaway = deducted only on pickup / takeaway / delivery orders.';

-- ------------------------------------------------------------------------------
-- 2. Update save_menu_recipe RPC to persist order_scope
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_menu_recipe(p_menu_id bigint, p_ingredients jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    item JSONB;
    v_count INT := 0;
    v_scope TEXT;
BEGIN
    DELETE FROM public.recipe_ingredients
    WHERE parent_menu_item_id = p_menu_id;

    IF p_ingredients IS NOT NULL AND jsonb_typeof(p_ingredients) = 'array' AND jsonb_array_length(p_ingredients) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_ingredients)
        LOOP
            v_scope := COALESCE(NULLIF(trim(item->>'order_scope'), ''), 'all');
            IF v_scope NOT IN ('all', 'dine_in', 'takeaway') THEN
                v_scope := 'all';
            END IF;

            INSERT INTO public.recipe_ingredients (
                parent_menu_item_id,
                ingredient_id,
                quantity,
                unit,
                layer_order,
                order_scope
            ) VALUES (
                p_menu_id,
                (item->>'ingredient_id')::UUID,
                (item->>'quantity')::NUMERIC,
                (item->>'unit')::TEXT,
                (item->>'layer_order')::INT,
                v_scope
            );
            v_count := v_count + 1;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'count', v_count);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- ------------------------------------------------------------------------------
-- 3. Helper: is_takeaway_sale
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_takeaway_sale(
    p_booking_id UUID,
    p_item_channel TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_b RECORD;
BEGIN
    IF lower(trim(COALESCE(p_item_channel, ''))) IN ('pickup', 'takeaway', 'delivery', 'lineman') THEN
        RETURN true;
    END IF;

    IF p_booking_id IS NULL THEN
        RETURN false;
    END IF;

    SELECT booking_type, order_type, source, staff_remark, table_id
    INTO v_b
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF lower(COALESCE(v_b.booking_type, '')) IN ('pickup', 'delivery', 'hausmade')
       OR lower(COALESCE(v_b.order_type, '')) LIKE '%pickup%'
       OR lower(COALESCE(v_b.source, '')) IN ('lineman', 'grab', 'delivery')
       OR lower(COALESCE(v_b.staff_remark, '')) LIKE '%lineman%'
       OR lower(COALESCE(v_b.staff_remark, '')) LIKE '%ออเดอร์กลับบ้าน%'
       OR lower(COALESCE(v_b.staff_remark, '')) LIKE '%walk-in pick-up%'
    THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Update stock_requirements_for_sale with optional p_is_takeaway flag
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.stock_requirements_for_sale(BIGINT, NUMERIC, JSONB);

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

-- ------------------------------------------------------------------------------
-- 5. Update record_sale_stock_shadow, triggers, and rebuild_sale_stock_shadow
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_sale_stock_shadow(BIGINT, UUID, BIGINT, NUMERIC, JSONB, TIMESTAMPTZ, BOOLEAN);

CREATE OR REPLACE FUNCTION public.record_sale_stock_shadow(
    p_order_item_id BIGINT,
    p_booking_id UUID,
    p_menu_item_id BIGINT,
    p_quantity NUMERIC,
    p_options JSONB,
    p_sold_at TIMESTAMPTZ,
    p_is_deleted BOOLEAN DEFAULT false,
    p_item_channel TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_takeaway BOOLEAN;
BEGIN
    UPDATE public.sale_stock_shadow
    SET voided_at = now()
    WHERE order_item_id = p_order_item_id AND voided_at IS NULL;

    IF p_is_deleted OR p_menu_item_id IS NULL THEN
        RETURN;
    END IF;

    v_is_takeaway := public.is_takeaway_sale(p_booking_id, p_item_channel);

    INSERT INTO public.sale_stock_shadow
        (order_item_id, booking_id, menu_item_id, stock_item_id, source, quantity, order_quantity, sold_at)
    SELECT p_order_item_id, p_booking_id, p_menu_item_id, r.stock_item_id, r.source,
           round(SUM(r.stock_qty), 4), p_quantity, COALESCE(p_sold_at, now())
    FROM public.stock_requirements_for_sale(p_menu_item_id, COALESCE(p_quantity, 1), p_options, v_is_takeaway) r
    GROUP BY r.stock_item_id, r.source
    HAVING round(SUM(r.stock_qty), 4) <> 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_order_item_stock_shadow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_mode TEXT;
    v_row JSONB;
    v_id BIGINT;
BEGIN
    SELECT mode INTO v_mode FROM public.stock_deduction_settings WHERE id;
    IF COALESCE(v_mode, 'off') = 'off' THEN
        RETURN NULL;
    END IF;

    v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
    v_id := (v_row->>'id')::bigint;

    BEGIN
        PERFORM public.record_sale_stock_shadow(
            v_id,
            NULLIF(v_row->>'booking_id', '')::uuid,
            CASE WHEN COALESCE((v_row->>'is_custom')::boolean, false) THEN NULL
                 ELSE NULLIF(v_row->>'menu_item_id', '')::bigint END,
            COALESCE(NULLIF(v_row->>'quantity', '')::numeric, 1),
            v_row->'selected_options',
            NULLIF(v_row->>'created_at', '')::timestamptz,
            TG_OP = 'DELETE' OR COALESCE(v_row->>'status', '') IN ('void', 'cancelled'),
            NULLIF(v_row->>'channel', ''));
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.stock_deduction_errors (order_item_id, message)
        VALUES (v_id, left(SQLERRM, 500));
    END;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_item_stock_shadow ON public.order_items;
CREATE TRIGGER trg_order_item_stock_shadow
AFTER INSERT OR DELETE OR UPDATE OF menu_item_id, quantity, selected_options, channel, status, booking_id ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_order_item_stock_shadow();

CREATE OR REPLACE FUNCTION public. rebuild_sale_stock_shadow(p_since TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row JSONB;
    v_count INT := 0;
    v_errors INT := 0;
BEGIN
    IF to_regclass('public.order_items') IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'order_items missing');
    END IF;
    FOR v_row IN EXECUTE 'SELECT to_jsonb(oi) FROM public.order_items oi WHERE oi.created_at >= $1' USING p_since
    LOOP
        BEGIN
            PERFORM public.record_sale_stock_shadow(
                (v_row->>'id')::bigint,
                NULLIF(v_row->>'booking_id', '')::uuid,
                CASE WHEN COALESCE((v_row->>'is_custom')::boolean, false) THEN NULL
                     ELSE NULLIF(v_row->>'menu_item_id', '')::bigint END,
                COALESCE(NULLIF(v_row->>'quantity', '')::numeric, 1),
                v_row->'selected_options',
                NULLIF(v_row->>'created_at', '')::timestamptz,
                COALESCE(v_row->>'status', '') IN ('void', 'cancelled'),
                NULLIF(v_row->>'channel', ''));
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
            INSERT INTO public.stock_deduction_errors (order_item_id, message)
            VALUES ((v_row->>'id')::bigint, 'rebuild: ' || left(SQLERRM, 480));
        END;
    END LOOP;
    RETURN jsonb_build_object('success', true, 'order_items', v_count, 'errors', v_errors);
END;
$$;

-- Permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        RETURN;
    END IF;
    REVOKE ALL ON FUNCTION public.rebuild_sale_stock_shadow(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON FUNCTION public.record_sale_stock_shadow(BIGINT, UUID, BIGINT, NUMERIC, JSONB, TIMESTAMPTZ, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON FUNCTION public.stock_requirements_for_sale(BIGINT, NUMERIC, JSONB, BOOLEAN) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.stock_requirements_for_sale(BIGINT, NUMERIC, JSONB, BOOLEAN) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.is_takeaway_sale(UUID, TEXT) TO authenticated;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
