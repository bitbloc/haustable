-- ==============================================================================
-- Migration: Shadow stock deduction from sales + option ingredients
-- (Stock roadmap · Phase 1/2, runs after 20261113150000)
-- Date: 2026-11-14
--
-- Shadow mode: every order item is exploded into the stock it would consume
-- (menu recipe + chosen options) and written to sale_stock_shadow. Real stock
-- (stock_items.current_quantity) is NOT touched. The numbers are compared with
-- staff counts for a week or two to catch wrong recipes before going live.
--
-- Also:
--   * option_choice_ingredients: what a chosen option adds or removes
--     (extra shot, oat milk, add-on egg, "Cocktail" vs "Mocktail", set drink).
--   * One serving rule: a per-glass / per-dish recipe item always means one
--     serving, whatever pack_size / conversion_factor it carried before.
--
-- The trigger never blocks a sale: any error is written to
-- stock_deduction_errors and the order item is saved as usual.
-- Safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. One serving rule for item_type = 'recipe'
-- ------------------------------------------------------------------------------
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

-- Re-run the trigger on existing recipe rows so they follow the rule.
UPDATE public.stock_items
SET usage_unit = 'unit'
WHERE item_type = 'recipe'
  AND (COALESCE(pack_size, 1) <> 1 OR COALESCE(conversion_factor, 1) <> 1
       OR COALESCE(usage_unit, '') <> 'unit' OR COALESCE(pack_unit, '') <> 'unit'
       OR COALESCE(yield_percent, 100) <> 100);

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

    -- usage_unit made by one making: a recipe is one serving; a passthrough prep
    -- yields its portion_yield_qty.
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

-- ------------------------------------------------------------------------------
-- 2. Option choice -> stock
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.option_choices') IS NULL OR to_regclass('public.menu_items') IS NULL THEN
        RAISE NOTICE 'option_choices or menu_items missing; option_choice_ingredients created without foreign keys';
        CREATE TABLE IF NOT EXISTS public.option_choice_ingredients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            choice_id UUID NOT NULL,
            menu_item_id BIGINT,
            stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
            quantity NUMERIC(14,4) NOT NULL CHECK (quantity <> 0),
            unit TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    ELSE
        CREATE TABLE IF NOT EXISTS public.option_choice_ingredients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            choice_id UUID NOT NULL REFERENCES public.option_choices(id) ON DELETE CASCADE,
            menu_item_id BIGINT REFERENCES public.menu_items(id) ON DELETE CASCADE,
            stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
            quantity NUMERIC(14,4) NOT NULL CHECK (quantity <> 0),
            unit TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    END IF;
END $$;

COMMENT ON TABLE public.option_choice_ingredients IS
  'What choosing an option adds (quantity > 0) or removes (quantity < 0), in the stock item''s usage_unit, per ordered item. menu_item_id NULL = every menu; rows for a specific menu replace the generic rows of that choice.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_option_choice_ingredients
    ON public.option_choice_ingredients (choice_id, COALESCE(menu_item_id, -1), stock_item_id);

-- ------------------------------------------------------------------------------
-- 3. Settings, shadow ledger, error log
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_deduction_settings (
    id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
    mode TEXT NOT NULL DEFAULT 'shadow' CHECK (mode IN ('off', 'shadow')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.stock_deduction_settings (id, mode) VALUES (true, 'shadow') ON CONFLICT (id) DO NOTHING;
COMMENT ON TABLE public.stock_deduction_settings IS 'off = ignore sales; shadow = record what sales would deduct without touching stock. Live deduction is added in a later migration.';

CREATE TABLE IF NOT EXISTS public.sale_stock_shadow (
    id BIGSERIAL PRIMARY KEY,
    order_item_id BIGINT NOT NULL,
    booking_id UUID,
    menu_item_id BIGINT,
    stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('recipe', 'option')),
    quantity NUMERIC(14,4) NOT NULL,          -- in the stock item's counting unit; > 0 = consumed
    order_quantity NUMERIC(14,4),
    sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    voided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sale_stock_shadow_open ON public.sale_stock_shadow (order_item_id) WHERE voided_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sale_stock_shadow_item_sold ON public.sale_stock_shadow (stock_item_id, sold_at) WHERE voided_at IS NULL;

CREATE TABLE IF NOT EXISTS public.stock_deduction_errors (
    id BIGSERIAL PRIMARY KEY,
    order_item_id BIGINT,
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 4. What one order line consumes
-- ------------------------------------------------------------------------------
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

-- Recompute the shadow rows of one order line (previous rows are kept, voided).
CREATE OR REPLACE FUNCTION public.record_sale_stock_shadow(
    p_order_item_id BIGINT,
    p_booking_id UUID,
    p_menu_item_id BIGINT,
    p_quantity NUMERIC,
    p_options JSONB,
    p_sold_at TIMESTAMPTZ,
    p_is_deleted BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.sale_stock_shadow
    SET voided_at = now()
    WHERE order_item_id = p_order_item_id AND voided_at IS NULL;

    IF p_is_deleted OR p_menu_item_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.sale_stock_shadow
        (order_item_id, booking_id, menu_item_id, stock_item_id, source, quantity, order_quantity, sold_at)
    SELECT p_order_item_id, p_booking_id, p_menu_item_id, r.stock_item_id, r.source,
           round(SUM(r.stock_qty), 4), p_quantity, COALESCE(p_sold_at, now())
    FROM public.stock_requirements_for_sale(p_menu_item_id, COALESCE(p_quantity, 1), p_options) r
    GROUP BY r.stock_item_id, r.source
    HAVING round(SUM(r.stock_qty), 4) <> 0;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Trigger on order_items (never blocks the sale)
-- ------------------------------------------------------------------------------
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
            TG_OP = 'DELETE');
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.stock_deduction_errors (order_item_id, message)
        VALUES (v_id, left(SQLERRM, 500));
    END;
    RETURN NULL;
END;
$$;

DO $$
BEGIN
    IF to_regclass('public.order_items') IS NULL THEN
        RAISE NOTICE 'order_items missing; shadow trigger not created';
        RETURN;
    END IF;
    DROP TRIGGER IF EXISTS trg_order_item_stock_shadow ON public.order_items;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'selected_options') THEN
        CREATE TRIGGER trg_order_item_stock_shadow
        AFTER INSERT OR DELETE OR UPDATE OF menu_item_id, quantity, selected_options ON public.order_items
        FOR EACH ROW EXECUTE FUNCTION public.trg_fn_order_item_stock_shadow();
    ELSE
        CREATE TRIGGER trg_order_item_stock_shadow
        AFTER INSERT OR DELETE OR UPDATE OF menu_item_id, quantity ON public.order_items
        FOR EACH ROW EXECUTE FUNCTION public.trg_fn_order_item_stock_shadow();
    END IF;
END $$;

-- Rebuild shadow rows for past sales (used once below, and after recipe changes).
CREATE OR REPLACE FUNCTION public.rebuild_sale_stock_shadow(p_since TIMESTAMPTZ)
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
                false);
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

-- ------------------------------------------------------------------------------
-- 6. Read helper: theoretical usage per item per shop day (Asia/Bangkok)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.sale_stock_shadow_daily WITH (security_invoker = true) AS
SELECT (s.sold_at AT TIME ZONE 'Asia/Bangkok')::date AS shop_day,
       s.stock_item_id,
       round(SUM(s.quantity), 4) AS quantity,
       COUNT(DISTINCT s.order_item_id) AS order_lines
FROM public.sale_stock_shadow s
WHERE s.voided_at IS NULL
GROUP BY 1, 2;

-- ------------------------------------------------------------------------------
-- 7. Access: staff screens read; the POS never needs these directly
-- ------------------------------------------------------------------------------
ALTER TABLE public.option_choice_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_deduction_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_stock_shadow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_deduction_errors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        RETURN;
    END IF;
    DROP POLICY IF EXISTS option_choice_ingredients_staff ON public.option_choice_ingredients;
    CREATE POLICY option_choice_ingredients_staff ON public.option_choice_ingredients
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS stock_deduction_settings_read ON public.stock_deduction_settings;
    CREATE POLICY stock_deduction_settings_read ON public.stock_deduction_settings
        FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS sale_stock_shadow_read ON public.sale_stock_shadow;
    CREATE POLICY sale_stock_shadow_read ON public.sale_stock_shadow
        FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS stock_deduction_errors_read ON public.stock_deduction_errors;
    CREATE POLICY stock_deduction_errors_read ON public.stock_deduction_errors
        FOR SELECT TO authenticated USING (true);

    REVOKE ALL ON public.sale_stock_shadow_daily FROM anon;
    GRANT SELECT ON public.sale_stock_shadow_daily TO authenticated;
    REVOKE ALL ON FUNCTION public.rebuild_sale_stock_shadow(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON FUNCTION public.record_sale_stock_shadow(BIGINT, UUID, BIGINT, NUMERIC, JSONB, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON FUNCTION public.stock_requirements_for_sale(BIGINT, NUMERIC, JSONB) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.stock_requirements_for_sale(BIGINT, NUMERIC, JSONB) TO authenticated;
END $$;

-- ------------------------------------------------------------------------------
-- 8. Shadow history for the last 14 days, so there is something to compare today
-- ------------------------------------------------------------------------------
SELECT public.rebuild_sale_stock_shadow(now() - interval '14 days');

NOTIFY pgrst, 'reload schema';
