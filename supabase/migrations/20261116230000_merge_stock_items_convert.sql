-- Migration: 20261116230000_merge_stock_items_convert.sql
-- Description: Merge duplicated stock items even when the two are set up in different units.
-- Every duplicate pair in the shop's list uses different units ("1 กิโลกรัม = 1,000 กรัม" beside
-- "1 ถุง = 500 กรัม"), so the first version (20261116220000) refused all of them.
--
-- New third argument p_ratio: how many of the KEPT item's counting units one counting unit of
-- the REMOVED item is ("1 ถุง = 0.5 กิโลกรัม" -> 0.5). The person merging states it; the page
-- suggests it when both items are used in the same recipe unit. With it the removed item's
-- balance, history, counts, receipts and barcodes are converted into the kept item's unit, and
-- recipe amounts are converted into the kept item's recipe unit.
--
-- Also fixes the first version writing one ledger row too many: the removed item's history is
-- moved to the kept item AND the balance was raised through the direct-quantity trigger, which
-- recorded the same amount a second time. Nothing was merged with that version.
--
-- Refused, with nothing changed, when:
--   * the units differ and no ratio is given (UNITS_DIFFER);
--   * the units differ and the removed item has a recipe of its own (RECIPE_UNITS);
--   * both have a recipe of their own (BOTH_HAVE_RECIPES);
--   * a menu option is linked to both (OPTION_CONFLICT).
-- Only owner, admin or manager accounts may call it. Safe to re-run.

DROP FUNCTION IF EXISTS public.merge_stock_items(UUID, UUID);

CREATE OR REPLACE FUNCTION public.merge_stock_items(p_keep UUID, p_remove UUID, p_ratio NUMERIC DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_staff RECORD;
    v_keep RECORD;
    v_gone RECORD;
    v_same BOOLEAN;
    v_ratio NUMERIC := 1;      -- kept counting units per removed counting unit
    v_use NUMERIC := 1;        -- kept recipe units per removed recipe unit
    v_ku TEXT;
    v_gu TEXT;
    v_kf NUMERIC;
    v_gf NUMERIC;
    v_kb NUMERIC;
    v_gb NUMERIC;
    v_recipes INT := 0;
    v_own_recipe INT := 0;
    v_tx INT := 0;
    v_counts INT := 0;
    v_receipts INT := 0;
    v_barcodes INT := 0;
    v_options INT := 0;
    v_total NUMERIC;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_SIGNED_IN');
    END IF;
    SELECT id, role, display_name INTO v_staff FROM public.profiles WHERE id = v_uid;
    IF NOT FOUND OR COALESCE(v_staff.role, '') NOT IN ('owner', 'admin', 'manager') THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_ALLOWED');
    END IF;
    IF p_keep IS NULL OR p_remove IS NULL OR p_keep = p_remove THEN
        RETURN jsonb_build_object('success', false, 'code', 'SAME_ITEM');
    END IF;

    -- Lock both rows in id order so two merges cannot deadlock
    PERFORM 1 FROM public.stock_items WHERE id IN (p_keep, p_remove) ORDER BY id FOR UPDATE;
    SELECT * INTO v_keep FROM public.stock_items WHERE id = p_keep;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND'); END IF;
    SELECT * INTO v_gone FROM public.stock_items WHERE id = p_remove;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND'); END IF;

    v_ku := LOWER(TRIM(COALESCE(v_keep.usage_unit, '')));
    v_gu := LOWER(TRIM(COALESCE(v_gone.usage_unit, '')));
    v_kf := COALESCE(NULLIF(v_keep.conversion_factor, 0), 1);
    v_gf := COALESCE(NULLIF(v_gone.conversion_factor, 0), 1);

    v_same := LOWER(COALESCE(v_keep.unit, v_keep.pack_unit, '')) = LOWER(COALESCE(v_gone.unit, v_gone.pack_unit, ''))
          AND v_ku = v_gu
          AND v_kf = v_gf;

    IF NOT v_same THEN
        IF p_ratio IS NULL OR p_ratio <= 0 THEN
            RETURN jsonb_build_object('success', false, 'code', 'UNITS_DIFFER');
        END IF;
        v_ratio := p_ratio;
        -- Recipe amounts: grams stay grams. Only when the two recipe units are of different
        -- kinds (pieces against grams) do they follow the stated ratio.
        v_kb := CASE v_ku WHEN 'g' THEN 1 WHEN 'kg' THEN 1000 WHEN 'ml' THEN 1 WHEN 'l' THEN 1000 END;
        v_gb := CASE v_gu WHEN 'g' THEN 1 WHEN 'kg' THEN 1000 WHEN 'ml' THEN 1 WHEN 'l' THEN 1000 END;
        IF v_ku = v_gu THEN
            v_use := 1;
        ELSIF v_kb IS NOT NULL AND v_gb IS NOT NULL
              AND (v_ku IN ('g', 'kg')) = (v_gu IN ('g', 'kg')) THEN
            v_use := v_gb / v_kb;
        ELSE
            v_use := v_ratio * v_kf / v_gf;
        END IF;
    END IF;

    -- A recipe of its own (a base made in the shop)
    IF EXISTS (SELECT 1 FROM public.recipe_ingredients WHERE parent_stock_item_id = p_remove) THEN
        IF NOT v_same THEN
            RETURN jsonb_build_object('success', false, 'code', 'RECIPE_UNITS');
        END IF;
        IF EXISTS (SELECT 1 FROM public.recipe_ingredients WHERE parent_stock_item_id = p_keep) THEN
            RETURN jsonb_build_object('success', false, 'code', 'BOTH_HAVE_RECIPES');
        END IF;
        UPDATE public.recipe_ingredients SET parent_stock_item_id = p_keep WHERE parent_stock_item_id = p_remove;
        GET DIAGNOSTICS v_own_recipe = ROW_COUNT;
        UPDATE public.recipe_versions SET parent_stock_item_id = p_keep WHERE parent_stock_item_id = p_remove;
        UPDATE public.stock_items
        SET is_base_recipe = v_gone.is_base_recipe,
            item_type = v_gone.item_type,
            prep_mode = v_gone.prep_mode,
            portion_yield_qty = v_gone.portion_yield_qty
        WHERE id = p_keep;
    END IF;

    -- A menu option linked to both items
    IF EXISTS (
        SELECT 1
        FROM public.option_choice_ingredients a
        JOIN public.option_choice_ingredients b
          ON b.choice_id = a.choice_id
         AND COALESCE(b.menu_item_id, -1) = COALESCE(a.menu_item_id, -1)
        WHERE a.stock_item_id = p_remove AND b.stock_item_id = p_keep
    ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'OPTION_CONFLICT');
    END IF;

    UPDATE public.recipe_ingredients
    SET ingredient_id = p_keep,
        quantity = ROUND((quantity * v_use)::numeric, 4),
        -- a recipe row names the unit its amount is in; it follows the kept item's recipe unit
        unit = CASE WHEN v_ku = v_gu THEN unit ELSE v_keep.usage_unit END
    WHERE ingredient_id = p_remove;
    GET DIAGNOSTICS v_recipes = ROW_COUNT;

    UPDATE public.option_choice_ingredients
    SET stock_item_id = p_keep,
        quantity = ROUND((quantity * v_use)::numeric, 4),
        unit = CASE WHEN v_ku = v_gu THEN unit ELSE v_keep.usage_unit END
    WHERE stock_item_id = p_remove;
    GET DIAGNOSTICS v_options = ROW_COUNT;

    -- The removed item's figures, restated in the kept item's counting unit
    IF v_ratio <> 1 THEN
        UPDATE public.stock_count_lines
        SET system_qty = ROUND(system_qty * v_ratio, 4),
            counted_qty = ROUND(counted_qty * v_ratio, 4),
            diff = ROUND(diff * v_ratio, 4),
            unit_cost = ROUND(unit_cost / v_ratio, 4)
        WHERE stock_item_id = p_remove;
        UPDATE public.stock_receipt_lines
        SET quantity = GREATEST(ROUND(quantity * v_ratio, 4), 0.0001),
            unit_cost = ROUND(unit_cost / v_ratio, 4),
            old_cost_price = ROUND(old_cost_price / v_ratio, 4),
            new_cost_price = ROUND(new_cost_price / v_ratio, 4),
            balance_after = ROUND(balance_after * v_ratio, 4)
        WHERE stock_item_id = p_remove;
        UPDATE public.sale_stock_shadow
        SET quantity = ROUND(quantity * v_ratio, 4)
        WHERE stock_item_id = p_remove;
        UPDATE public.stock_item_barcodes
        SET units_per_scan = GREATEST(ROUND(units_per_scan * v_ratio, 4), 0.0001)
        WHERE stock_item_id = p_remove;
    END IF;

    -- Count sessions that counted both: one line per session and item, so the two are added
    UPDATE public.stock_count_lines k
    SET system_qty = COALESCE(k.system_qty, 0) + COALESCE(g.system_qty, 0),
        counted_qty = COALESCE(k.counted_qty, 0) + COALESCE(g.counted_qty, 0),
        diff = COALESCE(k.diff, 0) + COALESCE(g.diff, 0),
        value_diff = COALESCE(k.value_diff, 0) + COALESCE(g.value_diff, 0)
    FROM public.stock_count_lines g
    WHERE g.stock_item_id = p_remove AND k.stock_item_id = p_keep AND k.session_id = g.session_id;
    DELETE FROM public.stock_count_lines g
    WHERE g.stock_item_id = p_remove
      AND EXISTS (SELECT 1 FROM public.stock_count_lines k WHERE k.stock_item_id = p_keep AND k.session_id = g.session_id);
    UPDATE public.stock_count_lines SET stock_item_id = p_keep WHERE stock_item_id = p_remove;
    GET DIAGNOSTICS v_counts = ROW_COUNT;

    UPDATE public.stock_receipt_lines SET stock_item_id = p_keep WHERE stock_item_id = p_remove;
    GET DIAGNOSTICS v_receipts = ROW_COUNT;

    -- Ledger rows are moved as history. The ledger guard is switched off for these statements:
    -- the rows already carry the removed item's balance, so raising the kept item's quantity
    -- below must not write that amount a second time.
    PERFORM set_config('stock.ledger_writer', '1', true);
    UPDATE public.stock_transactions
    SET stock_item_id = p_keep,
        quantity_change = ROUND((quantity_change * v_ratio)::numeric, 4),
        balance_after = ROUND((balance_after * v_ratio)::numeric, 4)
    WHERE stock_item_id = p_remove;
    GET DIAGNOSTICS v_tx = ROW_COUNT;

    UPDATE public.sale_stock_shadow SET stock_item_id = p_keep WHERE stock_item_id = p_remove;
    UPDATE public.stock_item_barcodes SET stock_item_id = p_keep WHERE stock_item_id = p_remove;
    GET DIAGNOSTICS v_barcodes = ROW_COUNT;

    v_total := ROUND((COALESCE(v_keep.current_quantity, 0) + COALESCE(v_gone.current_quantity, 0) * v_ratio)::numeric, 4);

    -- Blanks on the kept item are filled from the removed one.
    UPDATE public.stock_items
    SET current_quantity = v_total,
        cost_price = CASE WHEN COALESCE(cost_price, 0) > 0 THEN cost_price
                          ELSE ROUND((COALESCE(v_gone.cost_price, 0) / v_ratio)::numeric, 4) END,
        image_url = COALESCE(NULLIF(image_url, ''), v_gone.image_url),
        makro_id = COALESCE(NULLIF(makro_id, ''), v_gone.makro_id),
        makro_sku = COALESCE(NULLIF(makro_sku, ''), v_gone.makro_sku),
        updated_at = NOW()
    WHERE id = p_keep;

    DELETE FROM public.stock_items WHERE id = p_remove;
    PERFORM set_config('stock.ledger_writer', '', true);

    -- The printed barcode moves last: the column may be unique
    IF COALESCE(v_keep.barcode, '') = '' AND COALESCE(v_gone.barcode, '') <> '' THEN
        UPDATE public.stock_items SET barcode = v_gone.barcode WHERE id = p_keep;
    END IF;

    INSERT INTO public.pos_audit_logs (shift_id, staff_id, staff_name, action_type, booking_id, amount, reason, metadata)
    VALUES (
        NULL, v_uid, COALESCE(NULLIF(TRIM(v_staff.display_name), ''), 'Staff'), 'stock_merge', NULL, 0,
        'รวมวัตถุดิบซ้ำ: ' || v_gone.name || ' → ' || v_keep.name,
        jsonb_build_object(
            'module', 'stock', 'kept_id', p_keep, 'kept_name', v_keep.name,
            'removed_id', p_remove, 'removed_name', v_gone.name,
            'removed_quantity', v_gone.current_quantity, 'removed_cost_price', v_gone.cost_price,
            'removed_unit', COALESCE(v_gone.unit, v_gone.pack_unit), 'removed_usage_unit', v_gone.usage_unit,
            'removed_factor', v_gone.conversion_factor,
            'kept_quantity_before', v_keep.current_quantity, 'kept_quantity_after', v_total,
            'ratio', v_ratio, 'recipe_ratio', v_use,
            'recipes', v_recipes, 'options', v_options, 'transactions', v_tx
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'kept_name', v_keep.name,
        'removed_name', v_gone.name,
        'quantity', v_total,
        'ratio', v_ratio,
        'moved', jsonb_build_object(
            'recipes', v_recipes, 'own_recipe_rows', v_own_recipe, 'options', v_options,
            'count_lines', v_counts, 'receipt_lines', v_receipts, 'transactions', v_tx, 'barcodes', v_barcodes
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_stock_items(UUID, UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_stock_items(UUID, UUID, NUMERIC) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
