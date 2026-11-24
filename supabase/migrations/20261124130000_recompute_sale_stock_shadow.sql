-- Recompute the sale shadow with today's recipes, on request (audit 2026-11-24, finding 5)
--
-- record_sale_stock_shadow runs once, when an order line is written. A recipe entered or
-- corrected afterwards never reached the lines already sold: ข้าวไข่เจียว got its recipe on
-- 2026-11-24 and every earlier sale of it still had no usage, so the reconciliation showed
-- the stock it used as unexplained loss. Until now only a migration could recompute
-- (rebuild_sale_stock_shadow is not callable from the app).
--
-- 1. recompute_sale_stock_shadow(p_from, p_to, p_menu_item_id, p_dry_run)
--      * back-office staff only (assert_stock_writer);
--      * shadow mode only: in live mode the usage has already moved real stock, and
--        rewriting it is not a matter for this function;
--      * p_menu_item_id NULL = every line in the period; otherwise the lines of that menu
--        plus the lines where a chosen option deducts that menu's recipe
--        (option_choice_ingredients.linked_menu_item_id, e.g. set-meal drink pairing);
--      * each line goes through record_sale_stock_shadow, the same code as a new sale, so
--        void bills stay out and "made, then wasted" rows are left alone;
--      * never further back than 62 days;
--      * p_dry_run counts the lines and changes nothing.
--    order_items.cost_at_sale is a snapshot of the cost on the day of sale and is not touched.
--
-- 2. One-off data repair
--      * is_sweetener was set on four items that are not sweeteners (salt, shoyu, a
--        seasoning sauce, a cut of beef). No menu with a sweetness option uses them today,
--        so nothing sold was affected; the flag is cleared before one does.
--      * Three recipe lines are labelled 'unit' (a piece) on an ingredient measured in
--        grams. The unit check reads 'unit' as "the ingredient's own unit", so it never
--        listed them and they deduct as 1 g / 4 g. They are relabelled 'pcs' so the check
--        lists them for a person to enter the real grams. Quantities are not changed.
--
-- Apply this file alone:
--   npx supabase db query --remote --yes -f supabase/migrations/20261124130000_recompute_sale_stock_shadow.sql
-- Safe to re-run.

BEGIN;

CREATE OR REPLACE FUNCTION public.recompute_sale_stock_shadow(
    p_from timestamptz,
    p_to timestamptz DEFAULT NULL,
    p_menu_item_id bigint DEFAULT NULL,
    p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_mode TEXT;
    v_from TIMESTAMPTZ;
    v_to TIMESTAMPTZ := COALESCE(p_to, now());
    v_row JSONB;
    v_lines INT := 0;
    v_errors INT := 0;
BEGIN
    PERFORM public.assert_stock_writer();

    IF p_from IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'NO_PERIOD');
    END IF;
    v_from := GREATEST(p_from, now() - interval '62 days');

    SELECT mode INTO v_mode FROM public.stock_deduction_settings WHERE id;
    IF COALESCE(v_mode, 'off') <> 'shadow' THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_SHADOW', 'mode', COALESCE(v_mode, 'off'));
    END IF;

    FOR v_row IN
        SELECT to_jsonb(oi)
        FROM public.order_items oi
        WHERE oi.created_at >= v_from
          AND oi.created_at < v_to
          AND (
              p_menu_item_id IS NULL
              OR oi.menu_item_id = p_menu_item_id
              OR EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(
                           CASE WHEN jsonb_typeof(oi.selected_options) = 'array'
                                THEN oi.selected_options ELSE '[]'::jsonb END) o
                  JOIN public.option_choice_ingredients oci ON oci.choice_id::text = o->>'choice_id'
                  WHERE oci.linked_menu_item_id = p_menu_item_id
              )
          )
        ORDER BY oi.id
    LOOP
        v_lines := v_lines + 1;
        IF NOT COALESCE(p_dry_run, false) THEN
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
            EXCEPTION WHEN OTHERS THEN
                v_errors := v_errors + 1;
                INSERT INTO public.stock_deduction_errors (order_item_id, message)
                VALUES ((v_row->>'id')::bigint, 'recompute: ' || left(SQLERRM, 470));
            END;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'lines', v_lines,
        'errors', v_errors,
        'from', v_from,
        'to', v_to,
        'dry_run', COALESCE(p_dry_run, false));
END;
$function$;

REVOKE ALL ON FUNCTION public.recompute_sale_stock_shadow(timestamptz, timestamptz, bigint, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_sale_stock_shadow(timestamptz, timestamptz, bigint, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.recompute_sale_stock_shadow(timestamptz, timestamptz, bigint, boolean) IS
  'Back office: rewrite the sale shadow of past order lines with today''s recipes (shadow mode only). p_menu_item_id NULL = every line in the period.';

-- Repair 1: sweetener flag on items that are not sweeteners.
UPDATE public.stock_items
SET is_sweetener = false
WHERE is_sweetener
  AND name IN ('เกลือสินเธาว์สกล/ถุง', 'โชยุ/แกลอน', 'ซอสฝาเขียว/แกลอน', 'หางว่าว(ลวกจิ้ม)/ถุง');

-- Repair 2: recipe lines counted in pieces on an ingredient measured by weight or volume.
UPDATE public.recipe_ingredients ri
SET unit = 'pcs'
FROM public.stock_items si
WHERE si.id = ri.ingredient_id
  AND lower(trim(COALESCE(ri.unit, ''))) = 'unit'
  AND lower(trim(COALESCE(si.usage_unit, ''))) IN ('g', 'kg', 'ml', 'l');

COMMIT;

NOTIFY pgrst, 'reload schema';
