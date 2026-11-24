-- Stock writers: back-office staff only (audit 2026-11-24, finding 1)
--
-- Before this file:
--   * set_stock_quantity / update_stock_quantity could be executed by anon, and nothing
--     underneath checked a role: anyone holding the public key could move a real balance.
--   * post_stock_movement, submit_stock_count, receive_stock, produce_prep, merge_stock_items
--     and save_menu_recipe were open to every signed-in account, customers included.
--   * several stock / recipe / SOP tables had "authenticated USING (true)" policies.
--
-- The function bodies below are the live production definitions (pg_get_functiondef,
-- 2026-11-24) with ONE added line each: PERFORM public.assert_stock_writer();
-- Nothing else in them is changed.
--
-- Who still passes: back-office staff (same test as the stock_items RLS policy), the
-- service role, and direct database sessions (SQL editor, CLI, cron) which carry no JWT.
-- The PIN-only POS never called these.

BEGIN;

CREATE OR REPLACE FUNCTION public.assert_stock_writer()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF COALESCE(auth.role(), '') IN ('', 'service_role') OR public.is_backoffice_staff() THEN
        RETURN;
    END IF;
    RAISE EXCEPTION 'stock: back-office staff only' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.assert_stock_writer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_stock_writer() TO authenticated, service_role;

-- post_stock_movement
CREATE OR REPLACE FUNCTION public.post_stock_movement(p_item_id uuid, p_mode text, p_quantity numeric, p_reason text DEFAULT NULL::text, p_performed_by text DEFAULT 'Staff'::text, p_note text DEFAULT NULL::text, p_ref_type text DEFAULT NULL::text, p_ref_id text DEFAULT NULL::text, p_shift_id text DEFAULT NULL::text, p_occurred_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_old NUMERIC;
    v_new NUMERIC;
    v_delta NUMERIC;
    v_type TEXT;
    v_reason TEXT;
    v_tx_id UUID;
BEGIN
    PERFORM public.assert_stock_writer();
    IF p_mode NOT IN ('delta', 'set') THEN
        RAISE EXCEPTION 'post_stock_movement: p_mode must be delta or set, got %', p_mode;
    END IF;
    IF p_quantity IS NULL THEN
        RAISE EXCEPTION 'post_stock_movement: p_quantity is required';
    END IF;

    -- Retry of an automatic movement that was already posted: return it unchanged.
    IF p_ref_type IS NOT NULL AND p_ref_id IS NOT NULL THEN
        SELECT id, balance_after, quantity_change INTO v_tx_id, v_new, v_delta
        FROM public.stock_transactions
        WHERE ref_type = p_ref_type AND ref_id = p_ref_id AND stock_item_id = p_item_id
          AND reason = COALESCE(p_reason, CASE WHEN p_mode = 'set' THEN 'count_adjust' ELSE 'adjust' END);
        IF FOUND THEN
            RETURN jsonb_build_object('success', true, 'duplicate', true, 'transaction_id', v_tx_id,
                                      'new_quantity', v_new, 'quantity_change', v_delta);
        END IF;
    END IF;

    SELECT COALESCE(current_quantity, 0)::numeric INTO v_old
    FROM public.stock_items WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'post_stock_movement: stock item % not found', p_item_id;
    END IF;

    IF p_mode = 'set' THEN
        v_new := round(p_quantity, 4);
        v_delta := v_new - v_old;
        v_type := 'set';
        v_reason := COALESCE(p_reason, 'count_adjust');
    ELSE
        v_delta := round(p_quantity, 4);
        v_new := v_old + v_delta;
        v_type := CASE WHEN v_delta >= 0 THEN 'in' ELSE 'out' END;
        v_reason := COALESCE(p_reason, 'adjust');
    END IF;

    IF v_reason NOT IN ('opening', 'purchase', 'sale', 'sale_void', 'waste', 'staff_meal',
                        'production_in', 'production_out', 'transfer', 'count_adjust', 'adjust') THEN
        RAISE EXCEPTION 'post_stock_movement: unknown reason %', v_reason;
    END IF;

    -- Tell the compatibility triggers this change is already being recorded here.
    PERFORM set_config('stock.ledger_writer', '1', true);

    UPDATE public.stock_items
    SET current_quantity = v_new, updated_at = now()
    WHERE id = p_item_id;

    INSERT INTO public.stock_transactions
        (stock_item_id, transaction_type, quantity_change, balance_after, reason,
         performed_by, note, ref_type, ref_id, shift_id, occurred_at)
    VALUES
        (p_item_id, v_type, v_delta, v_new, v_reason,
         COALESCE(p_performed_by, 'Staff'), p_note, p_ref_type, p_ref_id, p_shift_id, COALESCE(p_occurred_at, now()))
    RETURNING id INTO v_tx_id;

    PERFORM set_config('stock.ledger_writer', '', true);

    RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id,
                              'old_quantity', v_old, 'new_quantity', v_new, 'quantity_change', v_delta);
END;
$function$;

-- submit_stock_count
CREATE OR REPLACE FUNCTION public.submit_stock_count(p_kind text, p_lines jsonb, p_performed_by text DEFAULT 'Staff'::text, p_note text DEFAULT NULL::text, p_blind boolean DEFAULT false, p_shop_day date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_session UUID;
    v_line JSONB;
    v_item public.stock_items%ROWTYPE;
    v_counted NUMERIC;
    v_sys NUMERIC;
    v_cost NUMERIC;
    v_count INT := 0;
    v_value NUMERIC := 0;
    v_label TEXT;
BEGIN
    PERFORM public.assert_stock_writer();
    IF p_kind NOT IN ('opening', 'spot', 'closing') THEN
        RAISE EXCEPTION 'submit_stock_count: unknown kind %', p_kind;
    END IF;
    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'submit_stock_count: no lines';
    END IF;

    v_label := CASE p_kind WHEN 'opening' THEN 'นับเปิดร้าน' WHEN 'closing' THEN 'นับปิดร้าน' ELSE 'นับระหว่างวัน' END;

    INSERT INTO public.stock_count_sessions (kind, shop_day, blind, performed_by, note)
    VALUES (p_kind, COALESCE(p_shop_day, public.stock_shop_day(now())), COALESCE(p_blind, false),
            COALESCE(p_performed_by, 'Staff'), p_note)
    RETURNING id INTO v_session;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_counted := NULLIF(v_line->>'counted_qty', '')::numeric;
        IF v_counted IS NULL OR v_counted < 0 THEN
            RAISE EXCEPTION 'submit_stock_count: invalid count for item %', v_line->>'stock_item_id';
        END IF;

        SELECT * INTO v_item FROM public.stock_items
        WHERE id = (v_line->>'stock_item_id')::uuid
        FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'submit_stock_count: item % not found', v_line->>'stock_item_id';
        END IF;

        v_sys := COALESCE(v_item.current_quantity, 0)::numeric;
        v_cost := public.stock_count_unit_cost(v_item);

        PERFORM public.post_stock_movement(v_item.id, 'set', v_counted, 'count_adjust',
                                           COALESCE(p_performed_by, 'Staff'),
                                           COALESCE(NULLIF(v_line->>'note', ''), v_label),
                                           'count_session', v_session::text);

        INSERT INTO public.stock_count_lines
            (session_id, stock_item_id, system_qty, counted_qty, diff, unit_cost, value_diff, note)
        VALUES
            (v_session, v_item.id, v_sys, v_counted, v_counted - v_sys, v_cost,
             round((v_counted - v_sys) * COALESCE(v_cost, 0), 2), NULLIF(v_line->>'note', ''));

        v_count := v_count + 1;
        v_value := v_value + round((v_counted - v_sys) * COALESCE(v_cost, 0), 2);
    END LOOP;

    UPDATE public.stock_count_sessions
    SET line_count = v_count, value_diff = v_value
    WHERE id = v_session;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session,
        'kind', p_kind,
        'shop_day', COALESCE(p_shop_day, public.stock_shop_day(now())),
        'line_count', v_count,
        'value_diff', v_value,
        'lines', (SELECT jsonb_agg(jsonb_build_object(
                        'stock_item_id', l.stock_item_id, 'name', si.name, 'unit', si.unit,
                        'system_qty', l.system_qty, 'counted_qty', l.counted_qty,
                        'diff', l.diff, 'value_diff', l.value_diff)
                    ORDER BY abs(COALESCE(l.value_diff, 0)) DESC, abs(l.diff) DESC)
                  FROM public.stock_count_lines l
                  JOIN public.stock_items si ON si.id = l.stock_item_id
                  WHERE l.session_id = v_session)
    );
END;
$function$;

-- receive_stock
CREATE OR REPLACE FUNCTION public.receive_stock(p_lines jsonb, p_vendor text DEFAULT NULL::text, p_expense jsonb DEFAULT '{"mode": "none"}'::jsonb, p_performed_by text DEFAULT 'Staff'::text, p_note text DEFAULT NULL::text, p_client_ref text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_existing public.stock_receipts;
    v_receipt_id UUID;
    v_mode TEXT := COALESCE(p_expense->>'mode', 'none');
    v_expense_id UUID;
    v_total NUMERIC := 0;
    v_priced_lines INT := 0;
    v_count INT := 0;
    v_line RECORD;
    v_item public.stock_items;
    v_unit_cost NUMERIC;
    v_new_cost NUMERIC;
    v_move JSONB;
    v_names TEXT := '';
    v_vendor TEXT := NULLIF(trim(COALESCE(p_vendor, '')), '');
    v_date DATE;
BEGIN
    PERFORM public.assert_stock_writer();
    IF p_client_ref IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.stock_receipts WHERE client_ref = p_client_ref;
        IF FOUND THEN
            RETURN jsonb_build_object('success', true, 'duplicate', true, 'receipt_id', v_existing.id,
                                      'expense_id', v_existing.expense_id, 'line_count', v_existing.line_count,
                                      'total', v_existing.total);
        END IF;
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'receive_stock: no lines';
    END IF;
    IF v_mode NOT IN ('none', 'new', 'link') THEN
        RAISE EXCEPTION 'receive_stock: unknown expense mode %', v_mode;
    END IF;

    -- Same item twice on one bill -> one line (quantities and money added up).
    CREATE TEMP TABLE IF NOT EXISTS _receive_lines (
        stock_item_id UUID PRIMARY KEY, quantity NUMERIC, line_total NUMERIC, update_cost BOOLEAN
    ) ON COMMIT DROP;
    -- Supabase blocks a DELETE with no WHERE clause (pg_safeupdate), even on a temp table.
    DELETE FROM _receive_lines WHERE true;
    INSERT INTO _receive_lines
    SELECT (l->>'stock_item_id')::uuid,
           SUM((l->>'quantity')::numeric),
           CASE WHEN bool_and(NULLIF(l->>'line_total', '') IS NOT NULL)
                THEN SUM(NULLIF(l->>'line_total', '')::numeric) END,
           bool_or(COALESCE((l->>'update_cost')::boolean, true))
    FROM jsonb_array_elements(p_lines) l
    GROUP BY (l->>'stock_item_id')::uuid;

    IF EXISTS (SELECT 1 FROM _receive_lines WHERE quantity IS NULL OR quantity <= 0) THEN
        RAISE EXCEPTION 'receive_stock: every line needs a quantity above 0';
    END IF;
    IF EXISTS (SELECT 1 FROM _receive_lines WHERE line_total < 0) THEN
        RAISE EXCEPTION 'receive_stock: line total cannot be negative';
    END IF;

    SELECT COALESCE(SUM(line_total), 0), COUNT(line_total), COUNT(*)
    INTO v_total, v_priced_lines, v_count FROM _receive_lines;

    IF v_mode = 'new' AND (v_priced_lines < v_count OR v_total <= 0) THEN
        RAISE EXCEPTION 'receive_stock: a new expense needs a price on every line';
    END IF;

    -- Expense
    IF v_mode = 'link' THEN
        v_expense_id := NULLIF(p_expense->>'expense_id', '')::uuid;
        IF v_expense_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.store_expenses WHERE id = v_expense_id) THEN
            RAISE EXCEPTION 'receive_stock: expense to link not found';
        END IF;
    ELSIF v_mode = 'new' THEN
        SELECT string_agg(si.name, ', ' ORDER BY si.name) INTO v_names
        FROM _receive_lines r JOIN public.stock_items si ON si.id = r.stock_item_id;
        v_date := COALESCE(NULLIF(p_expense->>'expense_date', '')::date,
                           (now() AT TIME ZONE 'Asia/Bangkok')::date);
        INSERT INTO public.store_expenses
            (expense_date, title, category, vendor_name, doc_type, amount, vat_included, vat_amount,
             payment_method, notes)
        VALUES
            (v_date,
             left('รับของเข้าสต๊อก' || COALESCE(' · ' || v_vendor, ''), 200),
             'raw_material',
             COALESCE(v_vendor, 'ไม่ระบุ'),
             COALESCE(NULLIF(p_expense->>'doc_type', ''), 'cash_bill'),
             round(v_total, 2),
             COALESCE((p_expense->>'vat_included')::boolean, false),
             CASE WHEN COALESCE((p_expense->>'vat_included')::boolean, false)
                  THEN round(v_total * 7 / 107, 2) ELSE 0 END,
             COALESCE(NULLIF(p_expense->>'payment_method', ''), 'CASH'),
             left('รับของ ' || v_count || ' รายการ: ' || COALESCE(v_names, '') || COALESCE(' · ' || NULLIF(trim(p_note), ''), ''), 1000))
        RETURNING id INTO v_expense_id;
    END IF;

    INSERT INTO public.stock_receipts
        (client_ref, shop_day, vendor_name, expense_id, total, line_count, performed_by, note)
    VALUES
        (p_client_ref, public.stock_shop_day(now()), v_vendor, v_expense_id,
         CASE WHEN v_priced_lines > 0 THEN round(v_total, 2) END, v_count,
         COALESCE(NULLIF(trim(p_performed_by), ''), 'Staff'), NULLIF(trim(p_note), ''))
    RETURNING id INTO v_receipt_id;

    FOR v_line IN SELECT * FROM _receive_lines LOOP
        SELECT * INTO v_item FROM public.stock_items WHERE id = v_line.stock_item_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'receive_stock: stock item % not found', v_line.stock_item_id;
        END IF;
        IF v_item.item_type = 'recipe' THEN
            RAISE EXCEPTION 'receive_stock: % is a per-serving recipe, not stock', v_item.name;
        END IF;

        v_unit_cost := CASE WHEN v_line.line_total IS NOT NULL THEN v_line.line_total / v_line.quantity END;
        -- cost_price is per pack for raw items (pack_size x conversion_factor usage units);
        -- per portion for preps. Turn the price per counted unit back into that.
        v_new_cost := NULL;
        IF v_unit_cost IS NOT NULL AND v_line.update_cost AND v_unit_cost > 0 THEN
            v_new_cost := round(CASE
                WHEN v_item.item_type = 'prep' THEN v_unit_cost
                ELSE v_unit_cost
                     * (COALESCE(NULLIF(v_item.pack_size, 0), 1)::numeric * COALESCE(NULLIF(v_item.conversion_factor, 0), 1)::numeric)
                     / NULLIF(public.stock_usage_per_count_unit(v_item), 0)
            END, 4);
        END IF;

        v_move := public.post_stock_movement(
            v_item.id, 'delta', v_line.quantity, 'purchase', COALESCE(NULLIF(trim(p_performed_by), ''), 'Staff'),
            left('รับเข้า' || COALESCE(' · ' || v_vendor, '') ||
                 CASE WHEN v_unit_cost IS NOT NULL THEN ' · ฿' || round(v_unit_cost, 2) || '/หน่วย' ELSE '' END, 300),
            'stock_receipt', v_receipt_id::text);

        IF v_new_cost IS NOT NULL THEN
            UPDATE public.stock_items SET cost_price = v_new_cost WHERE id = v_item.id;
        END IF;

        INSERT INTO public.stock_receipt_lines
            (receipt_id, stock_item_id, quantity, line_total, unit_cost, old_cost_price, new_cost_price, balance_after)
        VALUES
            (v_receipt_id, v_item.id, v_line.quantity, v_line.line_total, round(v_unit_cost, 4),
             v_item.cost_price, v_new_cost, (v_move->>'new_quantity')::numeric);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 'duplicate', false, 'receipt_id', v_receipt_id, 'expense_id', v_expense_id,
        'line_count', v_count, 'total', CASE WHEN v_priced_lines > 0 THEN round(v_total, 2) END,
        'lines', (SELECT jsonb_agg(jsonb_build_object(
                      'stock_item_id', l.stock_item_id, 'name', si.name, 'unit', si.unit,
                      'quantity', l.quantity, 'unit_cost', l.unit_cost,
                      'old_cost_price', l.old_cost_price, 'new_cost_price', l.new_cost_price,
                      'balance_after', l.balance_after) ORDER BY si.name)
                  FROM public.stock_receipt_lines l JOIN public.stock_items si ON si.id = l.stock_item_id
                  WHERE l.receipt_id = v_receipt_id));
END;
$function$;

-- produce_prep
CREATE OR REPLACE FUNCTION public.produce_prep(p_item_id uuid, p_portions numeric, p_actual_yield numeric DEFAULT NULL::numeric, p_performed_by text DEFAULT 'Staff'::text, p_note text DEFAULT NULL::text)
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
    PERFORM public.assert_stock_writer();
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

-- merge_stock_items
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
    PERFORM public.assert_stock_writer();
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

-- save_menu_recipe
CREATE OR REPLACE FUNCTION public.save_menu_recipe(p_menu_id bigint, p_ingredients jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    item JSONB;
    v_count INT := 0;
    v_scope TEXT;
BEGIN
    PERFORM public.assert_stock_writer();
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

-- Legacy wrappers and the takeaway helper: no anonymous execution.
REVOKE ALL ON FUNCTION public.set_stock_quantity(uuid, double precision, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_stock_quantity(uuid, double precision, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_stock_quantity(uuid, double precision, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_stock_quantity(uuid, double precision, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_takeaway_sale(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_takeaway_sale(uuid, text) TO authenticated, service_role;

-- Table policies: "any signed-in account" becomes "back-office staff".
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON public.stock_transactions;
CREATE POLICY stock_transactions_backoffice_all ON public.stock_transactions
    FOR ALL TO authenticated USING (public.is_backoffice_staff()) WITH CHECK (public.is_backoffice_staff());

DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON public.stock_categories;
CREATE POLICY stock_categories_backoffice_all ON public.stock_categories
    FOR ALL TO authenticated USING (public.is_backoffice_staff()) WITH CHECK (public.is_backoffice_staff());

ALTER POLICY option_choice_ingredients_staff ON public.option_choice_ingredients USING (public.is_backoffice_staff()) WITH CHECK (public.is_backoffice_staff());
ALTER POLICY recipe_folders_staff ON public.recipe_folders USING (public.is_backoffice_staff()) WITH CHECK (public.is_backoffice_staff());
ALTER POLICY stock_item_barcodes_staff ON public.stock_item_barcodes USING (public.is_backoffice_staff()) WITH CHECK (public.is_backoffice_staff());
ALTER POLICY sop_recipes_write ON public.sop_recipes USING (public.is_backoffice_staff()) WITH CHECK (public.is_backoffice_staff());
ALTER POLICY sop_categories_write ON public.sop_categories USING (public.is_backoffice_staff()) WITH CHECK (public.is_backoffice_staff());
ALTER POLICY sop_glass_sizes_write ON public.sop_glass_sizes USING (public.is_backoffice_staff()) WITH CHECK (public.is_backoffice_staff());
ALTER POLICY recipe_versions_insert ON public.recipe_versions WITH CHECK (public.is_backoffice_staff());
ALTER POLICY recipe_versions_read ON public.recipe_versions USING (public.is_backoffice_staff());
ALTER POLICY sale_stock_shadow_read ON public.sale_stock_shadow USING (public.is_backoffice_staff());
ALTER POLICY stock_count_sessions_read ON public.stock_count_sessions USING (public.is_backoffice_staff());
ALTER POLICY stock_count_lines_read ON public.stock_count_lines USING (public.is_backoffice_staff());
ALTER POLICY stock_deduction_errors_read ON public.stock_deduction_errors USING (public.is_backoffice_staff());
ALTER POLICY stock_deduction_settings_read ON public.stock_deduction_settings USING (public.is_backoffice_staff());
ALTER POLICY stock_receipts_read ON public.stock_receipts USING (public.is_backoffice_staff());
ALTER POLICY stock_receipt_lines_read ON public.stock_receipt_lines USING (public.is_backoffice_staff());

-- Bar recipes are the shop's own: readable by back-office staff only (the page that shows
-- them, /staff/sop, already requires a staff sign-in).
ALTER POLICY sop_recipes_read ON public.sop_recipes TO authenticated USING (public.is_backoffice_staff());
ALTER POLICY sop_categories_read ON public.sop_categories TO authenticated USING (public.is_backoffice_staff());
ALTER POLICY sop_glass_sizes_read ON public.sop_glass_sizes TO authenticated USING (public.is_backoffice_staff());

COMMIT;
