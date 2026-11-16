-- Migration: 20261116220000_merge_stock_items.sql
-- Description: Merge a duplicated stock item into the one that is kept (stock check page).
-- The shop's list has pairs like "น้ำปลา" / "น้ำปลา" and "ถุงซิปใส 13*20" / "ถุงซิปใส 13*20/แพ็ค".
-- Everything that points at the removed item moves to the kept one, the quantities are added,
-- and the removed item is deleted, all in one transaction.
--
-- Refused, with nothing changed, when:
--   * the two items do not use the same units (quantities and recipe amounts would change meaning);
--   * both have a recipe of their own (two recipes cannot be merged by a rule);
--   * a menu option is linked to both (its amount per choice would have to be decided by a person).
-- Only owner, admin or manager accounts may call it. Safe to re-run.

CREATE OR REPLACE FUNCTION public.merge_stock_items(p_keep UUID, p_remove UUID)
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
    v_recipes INT := 0;
    v_own_recipe INT := 0;
    v_tx INT := 0;
    v_counts INT := 0;
    v_receipts INT := 0;
    v_barcodes INT := 0;
    v_options INT := 0;
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

    -- Same units, or the numbers would mean something else after the merge
    IF LOWER(COALESCE(v_keep.unit, v_keep.pack_unit, '')) <> LOWER(COALESCE(v_gone.unit, v_gone.pack_unit, ''))
       OR LOWER(COALESCE(v_keep.usage_unit, '')) <> LOWER(COALESCE(v_gone.usage_unit, ''))
       OR COALESCE(v_keep.conversion_factor, 1) <> COALESCE(v_gone.conversion_factor, 1) THEN
        RETURN jsonb_build_object('success', false, 'code', 'UNITS_DIFFER');
    END IF;

    -- A recipe of its own (a base made in the shop)
    IF EXISTS (SELECT 1 FROM public.recipe_ingredients WHERE parent_stock_item_id = p_remove) THEN
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

    UPDATE public.recipe_ingredients SET ingredient_id = p_keep WHERE ingredient_id = p_remove;
    GET DIAGNOSTICS v_recipes = ROW_COUNT;

    UPDATE public.option_choice_ingredients SET stock_item_id = p_keep WHERE stock_item_id = p_remove;
    GET DIAGNOSTICS v_options = ROW_COUNT;

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
    UPDATE public.stock_transactions SET stock_item_id = p_keep WHERE stock_item_id = p_remove;
    GET DIAGNOSTICS v_tx = ROW_COUNT;
    UPDATE public.sale_stock_shadow SET stock_item_id = p_keep WHERE stock_item_id = p_remove;
    UPDATE public.stock_item_barcodes SET stock_item_id = p_keep WHERE stock_item_id = p_remove;
    GET DIAGNOSTICS v_barcodes = ROW_COUNT;

    -- The removed item's history now belongs to the kept one, so its balance does too.
    -- Blanks on the kept item are filled from the removed one.
    UPDATE public.stock_items
    SET current_quantity = COALESCE(current_quantity, 0) + COALESCE(v_gone.current_quantity, 0),
        cost_price = CASE WHEN COALESCE(cost_price, 0) > 0 THEN cost_price ELSE v_gone.cost_price END,
        image_url = COALESCE(NULLIF(image_url, ''), v_gone.image_url),
        makro_id = COALESCE(NULLIF(makro_id, ''), v_gone.makro_id),
        makro_sku = COALESCE(NULLIF(makro_sku, ''), v_gone.makro_sku),
        updated_at = NOW()
    WHERE id = p_keep;

    DELETE FROM public.stock_items WHERE id = p_remove;

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
            'recipes', v_recipes, 'transactions', v_tx
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'kept_name', v_keep.name,
        'removed_name', v_gone.name,
        'quantity', COALESCE(v_keep.current_quantity, 0) + COALESCE(v_gone.current_quantity, 0),
        'moved', jsonb_build_object(
            'recipes', v_recipes, 'own_recipe_rows', v_own_recipe, 'options', v_options,
            'count_lines', v_counts, 'receipt_lines', v_receipts, 'transactions', v_tx, 'barcodes', v_barcodes
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_stock_items(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_stock_items(UUID, UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
