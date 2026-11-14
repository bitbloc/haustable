-- ==============================================================================
-- Reasons for removing items from a bill (roadmap D1)
--
-- When staff remove or reduce an item that was already sent to the kitchen or
-- bar, the POS asks why:
--   * not_made     -> nothing was used. The sale's usage is simply returned
--                     (the shadow trigger already does this on delete / reduce).
--   * made_wasted  -> the dish was made and thrown away. Its ingredients are
--                     recorded as waste (sale_stock_shadow rows with source
--                     'waste') so the daily reconciliation shows them in the
--                     waste column instead of as an unexplained difference.
--
-- order_item_removals keeps one row per removal (who, why, how many, price).
-- The POS has no Supabase login (anon), so it writes only through the two
-- functions below. A removal whose bill change then fails is cancelled.
-- Safe to re-run.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.order_item_removals (
    id BIGSERIAL PRIMARY KEY,
    order_item_id BIGINT NOT NULL,
    booking_id UUID,
    menu_item_id BIGINT,
    item_name TEXT,
    quantity_before NUMERIC(14,4) NOT NULL,
    quantity_after NUMERIC(14,4) NOT NULL,
    quantity_removed NUMERIC(14,4) NOT NULL CHECK (quantity_removed > 0),
    unit_price NUMERIC(14,2),
    selected_options JSONB,
    reason TEXT NOT NULL CHECK (reason IN ('not_made', 'made_wasted')),
    removed_by TEXT,
    note TEXT,
    removed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_order_item_removals_removed_at ON public.order_item_removals (removed_at);
CREATE INDEX IF NOT EXISTS idx_order_item_removals_booking ON public.order_item_removals (booking_id);
COMMENT ON TABLE public.order_item_removals IS
  'Items removed or reduced on a bill after being sent: not_made = nothing used, made_wasted = ingredients recorded as waste.';

-- ------------------------------------------------------------------------------
-- Waste rows live next to sale rows in sale_stock_shadow
-- ------------------------------------------------------------------------------
ALTER TABLE public.sale_stock_shadow ADD COLUMN IF NOT EXISTS removal_id BIGINT;
ALTER TABLE public.sale_stock_shadow DROP CONSTRAINT IF EXISTS sale_stock_shadow_source_check;
ALTER TABLE public.sale_stock_shadow ADD CONSTRAINT sale_stock_shadow_source_check
    CHECK (source IN ('recipe', 'option', 'waste'));
CREATE INDEX IF NOT EXISTS idx_sale_stock_shadow_removal ON public.sale_stock_shadow (removal_id) WHERE removal_id IS NOT NULL;

-- Recomputing a sale line must not touch the waste recorded for it.
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
    WHERE order_item_id = p_order_item_id AND voided_at IS NULL
      AND source IN ('recipe', 'option');

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

-- Sales usage only; waste is reported separately.
CREATE OR REPLACE VIEW public.sale_stock_shadow_daily WITH (security_invoker = true) AS
SELECT (s.sold_at AT TIME ZONE 'Asia/Bangkok')::date AS shop_day,
       s.stock_item_id,
       round(SUM(s.quantity), 4) AS quantity,
       COUNT(DISTINCT s.order_item_id) AS order_lines
FROM public.sale_stock_shadow s
WHERE s.voided_at IS NULL AND s.source IN ('recipe', 'option')
GROUP BY 1, 2;

-- ------------------------------------------------------------------------------
-- Record a removal. Call before deleting the row or lowering its quantity.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_order_item_removal(
    p_order_item_id BIGINT,
    p_new_quantity NUMERIC,
    p_reason TEXT,
    p_removed_by TEXT DEFAULT NULL,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row JSONB;
    v_before NUMERIC;
    v_after NUMERIC;
    v_removed NUMERIC;
    v_menu BIGINT;
    v_name TEXT;
    v_id BIGINT;
    v_lines INT := 0;
BEGIN
    IF p_reason IS NULL OR p_reason NOT IN ('not_made', 'made_wasted') THEN
        RAISE EXCEPTION 'log_order_item_removal: unknown reason %', p_reason;
    END IF;

    SELECT to_jsonb(oi) INTO v_row
    FROM public.order_items oi
    WHERE oi.id = p_order_item_id
    FOR UPDATE;
    IF v_row IS NULL THEN
        RAISE EXCEPTION 'log_order_item_removal: order item % not found', p_order_item_id;
    END IF;

    v_before := COALESCE(NULLIF(v_row->>'quantity', '')::numeric, 1);
    v_after := GREATEST(COALESCE(p_new_quantity, 0), 0);
    v_removed := v_before - v_after;
    IF v_removed <= 0 THEN
        RAISE EXCEPTION 'log_order_item_removal: nothing removed (% -> %)', v_before, v_after;
    END IF;

    v_menu := CASE WHEN COALESCE((v_row->>'is_custom')::boolean, false) THEN NULL
                   ELSE NULLIF(v_row->>'menu_item_id', '')::bigint END;
    IF v_menu IS NOT NULL THEN
        SELECT mi.name INTO v_name FROM public.menu_items mi WHERE mi.id = v_menu;
    END IF;
    v_name := COALESCE(NULLIF(v_row->>'name', ''), NULLIF(v_row->>'item_name', ''), NULLIF(v_row->>'custom_name', ''), v_name);

    INSERT INTO public.order_item_removals
        (order_item_id, booking_id, menu_item_id, item_name, quantity_before, quantity_after,
         quantity_removed, unit_price, selected_options, reason, removed_by, note)
    VALUES
        (p_order_item_id, NULLIF(v_row->>'booking_id', '')::uuid, v_menu, v_name, v_before, v_after,
         v_removed, NULLIF(v_row->>'price_at_time', '')::numeric, v_row->'selected_options',
         p_reason, NULLIF(trim(p_removed_by), ''), NULLIF(trim(p_note), ''))
    RETURNING id INTO v_id;

    IF p_reason = 'made_wasted' AND v_menu IS NOT NULL THEN
        BEGIN
            INSERT INTO public.sale_stock_shadow
                (order_item_id, booking_id, menu_item_id, stock_item_id, source, quantity, order_quantity, sold_at, removal_id)
            SELECT p_order_item_id, NULLIF(v_row->>'booking_id', '')::uuid, v_menu, r.stock_item_id, 'waste',
                   round(SUM(r.stock_qty), 4), v_removed, now(), v_id
            FROM public.stock_requirements_for_sale(v_menu, v_removed, v_row->'selected_options') r
            GROUP BY r.stock_item_id
            HAVING round(SUM(r.stock_qty), 4) <> 0;
            GET DIAGNOSTICS v_lines = ROW_COUNT;
        EXCEPTION WHEN OTHERS THEN
            -- The removal itself is still recorded; a broken recipe must not block the bill.
            INSERT INTO public.stock_deduction_errors (order_item_id, message)
            VALUES (p_order_item_id, 'removal waste: ' || left(SQLERRM, 480));
        END;
    END IF;

    RETURN jsonb_build_object('success', true, 'removal_id', v_id,
                              'quantity_removed', v_removed, 'waste_lines', v_lines);
END;
$$;

-- Undo a removal whose bill change did not go through.
CREATE OR REPLACE FUNCTION public.cancel_order_item_removal(p_removal_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_found BOOLEAN;
BEGIN
    UPDATE public.order_item_removals
    SET cancelled_at = now()
    WHERE id = p_removal_id AND cancelled_at IS NULL
    RETURNING true INTO v_found;

    UPDATE public.sale_stock_shadow
    SET voided_at = now()
    WHERE removal_id = p_removal_id AND voided_at IS NULL;

    RETURN jsonb_build_object('success', COALESCE(v_found, false));
END;
$$;

-- ------------------------------------------------------------------------------
-- Daily reconciliation: sales usage excludes waste rows, waste includes them
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_daily_reconciliation(p_day DATE)
RETURNS TABLE (
    stock_item_id UUID,
    name TEXT,
    category TEXT,
    unit TEXT,
    item_type TEXT,
    track_mode TEXT,
    opening_qty NUMERIC,
    opening_source TEXT,
    received NUMERIC,
    produced NUMERIC,
    used_in_production NUMERIC,
    waste NUMERIC,
    other_out NUMERIC,
    sales_usage NUMERIC,
    expected_close NUMERIC,
    closing_qty NUMERIC,
    closing_counted_at TIMESTAMPTZ,
    variance NUMERIC,
    unit_cost NUMERIC,
    variance_value NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_start TIMESTAMPTZ := public.stock_shop_day_start(p_day);
    v_end TIMESTAMPTZ := public.stock_shop_day_start(p_day + 1);
BEGIN
    RETURN QUERY
    WITH items AS (
        SELECT si.*
        FROM public.stock_items si
        WHERE (si.item_type = 'raw' OR (si.item_type = 'prep' AND si.prep_mode = 'stocked'))
          AND si.track_mode <> 'none'
    ),
    op AS (
        SELECT DISTINCT ON (l.stock_item_id) l.stock_item_id, l.counted_qty, s.created_at
        FROM public.stock_count_lines l
        JOIN public.stock_count_sessions s ON s.id = l.session_id
        WHERE s.shop_day = p_day AND s.kind = 'opening'
        ORDER BY l.stock_item_id, s.created_at DESC
    ),
    cl AS (
        SELECT DISTINCT ON (l.stock_item_id) l.stock_item_id, l.counted_qty, s.created_at
        FROM public.stock_count_lines l
        JOIN public.stock_count_sessions s ON s.id = l.session_id
        WHERE s.shop_day = p_day AND s.kind = 'closing'
        ORDER BY l.stock_item_id, s.created_at DESC
    ),
    win AS (
        SELECT i.id,
               COALESCE(op.created_at, v_start) AS w_start,
               COALESCE(cl.created_at, v_end) AS w_end,
               op.counted_qty AS op_qty,
               cl.counted_qty AS cl_qty,
               cl.created_at AS cl_at
        FROM items i
        LEFT JOIN op ON op.stock_item_id = i.id
        LEFT JOIN cl ON cl.stock_item_id = i.id
    ),
    -- Ledger balance at the window start. 'opening' rows (starting balance of an item
    -- created or re-baselined during the day) belong to the opening, not to receipts.
    bal AS (
        SELECT w.id, COALESCE(SUM(t.quantity_change), 0)::numeric AS qty
        FROM win w
        LEFT JOIN public.stock_transactions t
          ON t.stock_item_id = w.id
         AND (t.created_at <= w.w_start
              OR (t.reason = 'opening' AND t.created_at <= w.w_end))
        GROUP BY w.id
    ),
    mv AS (
        SELECT w.id,
               COALESCE(SUM(t.quantity_change) FILTER (WHERE t.reason = 'purchase'
                     OR (t.reason IN ('adjust', 'transfer') AND t.quantity_change > 0)), 0)::numeric AS received,
               COALESCE(SUM(t.quantity_change) FILTER (WHERE t.reason = 'production_in'), 0)::numeric AS produced,
               COALESCE(SUM(t.quantity_change) FILTER (WHERE t.reason = 'production_out'), 0)::numeric AS used_prod,
               COALESCE(SUM(t.quantity_change) FILTER (WHERE t.reason IN ('waste', 'staff_meal')), 0)::numeric AS waste,
               COALESCE(SUM(t.quantity_change) FILTER (WHERE t.reason IN ('adjust', 'transfer') AND t.quantity_change < 0), 0)::numeric AS other_out
        FROM win w
        JOIN public.stock_transactions t
          ON t.stock_item_id = w.id AND t.created_at > w.w_start AND t.created_at <= w.w_end
         AND t.reason IN ('purchase', 'adjust', 'transfer', 'production_in', 'production_out', 'waste', 'staff_meal')
        GROUP BY w.id
    ),
    sales AS (
        SELECT w.id, COALESCE(SUM(s.quantity), 0)::numeric AS qty
        FROM win w
        JOIN public.sale_stock_shadow s
          ON s.stock_item_id = w.id AND s.voided_at IS NULL
         AND s.source IN ('recipe', 'option')
         AND s.sold_at > w.w_start AND s.sold_at <= w.w_end
        GROUP BY w.id
    ),
    -- Dishes made and thrown away (removed from a bill as "made, then wasted").
    -- Stored as positive usage, folded into the waste column.
    sw AS (
        SELECT w.id, COALESCE(SUM(s.quantity), 0)::numeric AS qty
        FROM win w
        JOIN public.sale_stock_shadow s
          ON s.stock_item_id = w.id AND s.voided_at IS NULL
         AND s.source = 'waste'
         AND s.sold_at > w.w_start AND s.sold_at <= w.w_end
        GROUP BY w.id
    )
    SELECT i.id, i.name, i.category, i.unit, i.item_type, i.track_mode,
           round(COALESCE(w.op_qty, b.qty), 4),
           CASE WHEN w.op_qty IS NOT NULL THEN 'count' ELSE 'ledger' END,
           round(COALESCE(m.received, 0), 4),
           round(COALESCE(m.produced, 0), 4),
           round(-COALESCE(m.used_prod, 0), 4),
           round(-(COALESCE(m.waste, 0) - COALESCE(sx.qty, 0)), 4),
           round(-COALESCE(m.other_out, 0), 4),
           round(COALESCE(sa.qty, 0), 4),
           round(COALESCE(w.op_qty, b.qty) + COALESCE(m.received, 0) + COALESCE(m.produced, 0)
                 + COALESCE(m.used_prod, 0) + (COALESCE(m.waste, 0) - COALESCE(sx.qty, 0)) + COALESCE(m.other_out, 0)
                 - COALESCE(sa.qty, 0), 4),
           w.cl_qty,
           w.cl_at,
           CASE WHEN w.cl_qty IS NULL THEN NULL ELSE round(w.cl_qty - (
                COALESCE(w.op_qty, b.qty) + COALESCE(m.received, 0) + COALESCE(m.produced, 0)
                + COALESCE(m.used_prod, 0) + (COALESCE(m.waste, 0) - COALESCE(sx.qty, 0)) + COALESCE(m.other_out, 0)
                - COALESCE(sa.qty, 0)), 4) END,
           round(public.stock_count_unit_cost(i::public.stock_items), 4),
           CASE WHEN w.cl_qty IS NULL THEN NULL ELSE round((w.cl_qty - (
                COALESCE(w.op_qty, b.qty) + COALESCE(m.received, 0) + COALESCE(m.produced, 0)
                + COALESCE(m.used_prod, 0) + (COALESCE(m.waste, 0) - COALESCE(sx.qty, 0)) + COALESCE(m.other_out, 0)
                - COALESCE(sa.qty, 0))) * public.stock_count_unit_cost(i::public.stock_items), 2) END
    FROM items i
    JOIN win w ON w.id = i.id
    JOIN bal b ON b.id = i.id
    LEFT JOIN mv m ON m.id = i.id
    LEFT JOIN sales sa ON sa.id = i.id
    LEFT JOIN sw sx ON sx.id = i.id
    WHERE i.track_mode = 'daily'
       OR w.op_qty IS NOT NULL OR w.cl_qty IS NOT NULL
       OR m.id IS NOT NULL OR sa.id IS NOT NULL OR sx.id IS NOT NULL;
END;
$$;

-- ------------------------------------------------------------------------------
-- Access
-- ------------------------------------------------------------------------------
ALTER TABLE public.order_item_removals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        RETURN;
    END IF;
    DROP POLICY IF EXISTS order_item_removals_read ON public.order_item_removals;
    CREATE POLICY order_item_removals_read ON public.order_item_removals FOR SELECT TO authenticated USING (true);

    -- The POS signs in with a staff PIN only, so it reaches the database as anon.
    REVOKE ALL ON FUNCTION public.log_order_item_removal(BIGINT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.log_order_item_removal(BIGINT, NUMERIC, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
    REVOKE ALL ON FUNCTION public.cancel_order_item_removal(BIGINT) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.cancel_order_item_removal(BIGINT) TO anon, authenticated, service_role;
END $$;

NOTIFY pgrst, 'reload schema';
