-- ==============================================================================
-- Receiving stock against a purchase (roadmap Phase 3, "รับเข้า")
--
-- One save records what came in and what it cost:
--   * stock_receipts / stock_receipt_lines   what was received, from whom, by whom
--   * stock_transactions                     one 'purchase' movement per item,
--                                            ref_type 'stock_receipt' (retry-safe)
--   * stock_items.cost_price                 latest price, when the line asks for it
--   * store_expenses                         a new expense for the bill, or a link to
--                                            one already recorded (AI scan / LINE),
--                                            so the bill is never counted twice
--
-- receive_stock() does all of it in one transaction. client_ref makes a double
-- tap on "save" return the first receipt instead of receiving twice.
-- Safe to re-run.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.stock_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_ref TEXT UNIQUE,
    shop_day DATE NOT NULL,
    vendor_name TEXT,
    expense_id UUID,
    total NUMERIC(14,2),
    line_count INT NOT NULL DEFAULT 0,
    performed_by TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_day ON public.stock_receipts (shop_day DESC);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_expense ON public.stock_receipts (expense_id) WHERE expense_id IS NOT NULL;

DO $$
BEGIN
    IF to_regclass('public.store_expenses') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_receipts_expense_fk') THEN
        ALTER TABLE public.stock_receipts
            ADD CONSTRAINT stock_receipts_expense_fk FOREIGN KEY (expense_id)
            REFERENCES public.store_expenses(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.stock_receipt_lines (
    id BIGSERIAL PRIMARY KEY,
    receipt_id UUID NOT NULL REFERENCES public.stock_receipts(id) ON DELETE CASCADE,
    stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
    quantity NUMERIC(14,4) NOT NULL CHECK (quantity > 0),     -- counted units
    line_total NUMERIC(14,2) CHECK (line_total >= 0),          -- baht for this line, if known
    unit_cost NUMERIC(14,4),                                   -- baht per counted unit
    old_cost_price NUMERIC(14,4),
    new_cost_price NUMERIC(14,4),
    balance_after NUMERIC(14,4)
);
CREATE INDEX IF NOT EXISTS idx_stock_receipt_lines_receipt ON public.stock_receipt_lines (receipt_id);
CREATE INDEX IF NOT EXISTS idx_stock_receipt_lines_item ON public.stock_receipt_lines (stock_item_id);

COMMENT ON TABLE public.stock_receipts IS 'Goods received into stock; expense_id links the bill in store_expenses.';

-- ------------------------------------------------------------------------------
-- receive_stock
--   p_lines   [{ stock_item_id, quantity, line_total?, update_cost? }]  quantity in counted units
--   p_expense { mode: 'none' | 'new' | 'link', expense_id?, expense_date?, doc_type?,
--               payment_method?, vat_included? }
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.receive_stock(
    p_lines JSONB,
    p_vendor TEXT DEFAULT NULL,
    p_expense JSONB DEFAULT '{"mode":"none"}'::jsonb,
    p_performed_by TEXT DEFAULT 'Staff',
    p_note TEXT DEFAULT NULL,
    p_client_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    DELETE FROM _receive_lines;
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
$$;

-- ------------------------------------------------------------------------------
-- Access: staff sign in to receive; writes only through receive_stock
-- ------------------------------------------------------------------------------
ALTER TABLE public.stock_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_receipt_lines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        RETURN;
    END IF;
    DROP POLICY IF EXISTS stock_receipts_read ON public.stock_receipts;
    CREATE POLICY stock_receipts_read ON public.stock_receipts FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS stock_receipt_lines_read ON public.stock_receipt_lines;
    CREATE POLICY stock_receipt_lines_read ON public.stock_receipt_lines FOR SELECT TO authenticated USING (true);

    REVOKE ALL ON FUNCTION public.receive_stock(JSONB, TEXT, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.receive_stock(JSONB, TEXT, JSONB, TEXT, TEXT, TEXT) TO authenticated, service_role;
END $$;

NOTIFY pgrst, 'reload schema';
