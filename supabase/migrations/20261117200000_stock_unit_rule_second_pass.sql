-- ==============================================================================
-- Stock unit rule, second pass (audit 2026-11-17). Sales deduction is still in shadow mode;
-- no stock quantity is changed by this file. Built from the live definitions read on
-- 2026-11-17; only the parts described below differ.
--
-- 1. stock_usage_per_count_unit: an item counted in a weight or volume unit of the same kind as
--    its pack (counted in g, bought in kg) is converted by the units (1 g = 1 g), not read as the
--    whole pack (was 1 g = 1,000 g). A pack of pieces counted per crate (pack of 12 bottles,
--    counted in ลัง) is the whole pack (was 1 bottle). Thai unit names count as their codes.
-- 2. stock_recipe_requirements: a stocked prep with no measured yield takes nothing off
--    (was 1 portion per ml or g).
-- 3. merge_stock_items: "same set-up" also needs the same amount per counted unit; a given ratio
--    is always used; recipe amounts follow what one counted unit holds; the removed price is
--    converted per counted unit, then into the kept item's pack.
-- 4. Data: four packaging items counted in "g" but bought in kg keep their meaning (one counted
--    unit = the 1 kg pack) by being counted in kg.
-- Apply this file alone: npx supabase db query --remote --yes -f <this file>
-- ==============================================================================

BEGIN;

-- One code per unit name, Thai or English (same list as src/utils/recipeGraph.js unitCode)
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
        ('box', 'box'), ('กล่อง', 'box'), ('bag', 'bag'), ('ถุง', 'bag'), ('glass', 'glass'), ('แก้ว', 'glass')
    ) AS m(name, code) ON m.name = lower(trim(COALESCE(p_unit, '')));
$$;

-- Weights and volumes in their base unit (g or ml), by unit code. A "gallon" is a jug of any
-- size in a Thai shop (Aro: 6 l), so it has no fixed ratio and is not listed.
CREATE OR REPLACE FUNCTION public.stock_measure_base(p_code TEXT)
RETURNS TABLE (kind TEXT, base NUMERIC)
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT m.kind, m.base FROM (VALUES
        ('g', 'mass', 1::numeric), ('kg', 'mass', 1000), ('mg', 'mass', 0.001), ('ขีด', 'mass', 100),
        ('lb', 'mass', 453.592), ('oz', 'mass', 28.3495),
        ('ml', 'volume', 1), ('l', 'volume', 1000), ('oz_fl', 'volume', 29.5735),
        ('cup', 'volume', 240), ('tbsp', 'volume', 15), ('tsp', 'volume', 5)
    ) AS m(code, kind, base)
    WHERE m.code = p_code;
$$;

-- Rule (also in src/utils/recipeGraph.js usagePerStockUnit):
--   counted and bought in weights or volumes of one kind -> unit ratio x conversion_factor
--   counted in the pack unit itself                       -> conversion_factor
--   bought by weight/volume, counted in a container       -> pack_size x conversion_factor (soda: 325 ml)
--   a pack of pieces counted per pack under another name  -> pack_size x conversion_factor (crate: 12)
--   otherwise                                             -> conversion_factor (coke counted per bottle: 1)
CREATE OR REPLACE FUNCTION public.stock_usage_per_count_unit(p_item public.stock_items)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
    WITH u AS (
        SELECT public.stock_unit_code(p_item.pack_unit) AS pk,
               public.stock_unit_code(COALESCE(NULLIF(trim(p_item.unit), ''), p_item.pack_unit)) AS cu,
               public.stock_unit_code(p_item.usage_unit) AS uu,
               COALESCE(NULLIF(p_item.conversion_factor, 0), 1)::numeric AS f,
               COALESCE(p_item.pack_size, 0)::numeric AS ps
    )
    SELECT CASE
        WHEN cm.kind IS NOT NULL AND cm.kind = pm.kind THEN cm.base / pm.base * u.f
        WHEN u.cu = u.pk THEN u.f
        WHEN (pm.kind IS NOT NULL OR u.pk IN ('gallon', 'shot')) AND u.ps > 0 THEN u.ps * u.f
        WHEN u.ps > 0 AND u.cu <> u.uu THEN u.ps * u.f
        ELSE u.f
    END
    FROM u
    LEFT JOIN LATERAL public.stock_measure_base(u.pk) pm ON true
    LEFT JOIN LATERAL public.stock_measure_base(u.cu) cm ON true;
$$;

CREATE OR REPLACE FUNCTION public.stock_recipe_requirements(p_item_id uuid, p_usage_qty numeric, p_depth integer DEFAULT 0)
 RETURNS TABLE(stock_item_id uuid, stock_qty numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        -- A stocked prep with no measured yield cannot say how many portions 30 ml is:
        -- take nothing off rather than 30 portions (the stock health page lists these)
        IF v_item.item_type = 'prep' AND COALESCE(v_item.portion_yield_qty, 0) <= 0 THEN
            RETURN;
        END IF;
        stock_item_id := v_item.id;
        stock_qty := p_usage_qty
            / NULLIF(CASE WHEN v_item.item_type = 'prep' THEN COALESCE(NULLIF(v_item.conversion_factor, 0), 1)::numeric
                          ELSE public.stock_usage_per_count_unit(v_item) END, 0)
            / (LEAST(GREATEST(COALESCE(v_item.yield_percent, 100), 1), 100)::numeric / 100);
        RETURN NEXT;
        RETURN;
    END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.merge_stock_items(p_keep uuid, p_remove uuid, p_ratio numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_staff RECORD;
    v_keep public.stock_items%ROWTYPE;
    v_gone public.stock_items%ROWTYPE;
    v_kper NUMERIC;            -- recipe units in one counted unit of the kept item
    v_gper NUMERIC;            -- ... of the removed item
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

    -- What one counted unit holds, the same rule sales deduction uses (a soda bottle is 325 ml,
    -- not 1 ml); a prep's counted unit is one portion of conversion_factor
    v_kper := CASE WHEN v_keep.item_type = 'prep' THEN v_kf ELSE public.stock_usage_per_count_unit(v_keep) END;
    v_gper := CASE WHEN v_gone.item_type = 'prep' THEN v_gf ELSE public.stock_usage_per_count_unit(v_gone) END;

    -- Same set-up only when one counted unit holds the same amount too (a 325 ml soda and a
    -- 1,250 ml soda are both "ขวด" of ml, but not the same bottle)
    v_same := LOWER(COALESCE(v_keep.unit, v_keep.pack_unit, '')) = LOWER(COALESCE(v_gone.unit, v_gone.pack_unit, ''))
          AND v_ku = v_gu
          AND v_kper = v_gper;

    IF NOT v_same AND (p_ratio IS NULL OR p_ratio <= 0) THEN
        RETURN jsonb_build_object('success', false, 'code', 'UNITS_DIFFER');
    END IF;
    -- A ratio a person gave is always used
    IF p_ratio IS NOT NULL AND p_ratio > 0 THEN
        v_ratio := p_ratio;
    END IF;
    -- Recipe amounts: a gram stays a gram, a kilogram is 1,000 grams. Otherwise they follow what
    -- one counted unit holds: removed soda (325 ml a bottle) into a crate of 24 bottles at
    -- ratio 1/24 -> 1 ml = 1/24 x 24 / 325 bottle.
    v_kb := CASE v_ku WHEN 'g' THEN 1 WHEN 'kg' THEN 1000 WHEN 'ml' THEN 1 WHEN 'l' THEN 1000 END;
    v_gb := CASE v_gu WHEN 'g' THEN 1 WHEN 'kg' THEN 1000 WHEN 'ml' THEN 1 WHEN 'l' THEN 1000 END;
    IF v_ku = v_gu THEN
        v_use := 1;
    ELSIF v_kb IS NOT NULL AND v_gb IS NOT NULL
          AND (v_ku IN ('g', 'kg')) = (v_gu IN ('g', 'kg')) THEN
        v_use := v_gb / v_kb;
    ELSE
        v_use := v_ratio * v_kper / NULLIF(v_gper, 0);
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
        -- cost_price is per pack (raw) or per portion (prep): the removed item's price per counted
        -- unit, said per kept counted unit, then back into the kept item's pack (receive_stock's rule)
        cost_price = CASE WHEN COALESCE(cost_price, 0) > 0 THEN cost_price
                          ELSE ROUND((COALESCE(public.stock_count_unit_cost(v_gone), 0) / v_ratio
                                * CASE WHEN v_keep.item_type = 'prep' THEN 1
                                       ELSE COALESCE(NULLIF(v_keep.pack_size, 0), 1)::numeric * v_kf / NULLIF(v_kper, 0) END
                               )::numeric, 4) END,
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
$function$;

-- Four packaging items set up by weight and counted in "g": one counted unit has always meant
-- the whole 1 kg pack. Counting them in kg keeps that meaning under the new rule.
UPDATE public.stock_items
SET unit = pack_unit, updated_at = now()
WHERE lower(trim(unit)) = 'g' AND lower(trim(pack_unit)) = 'kg'
  AND COALESCE(pack_size, 0) = 1 AND conversion_factor = 1000;

COMMIT;

NOTIFY pgrst, 'reload schema';
