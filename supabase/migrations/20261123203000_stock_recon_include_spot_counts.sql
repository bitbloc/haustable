-- ==============================================================================
-- Stock Daily Reconciliation: Include real-world spot counts (Staff Stock page)
--
-- In daily operations, staff frequently count individual items from /staff/stock
-- (saved as stock_count_sessions.kind = 'spot') instead of running a separate
-- closing session. Previously, stock_daily_reconciliation only read
-- kind = 'closing', leaving closing_qty / variance NULL on every day and hiding
-- all actual count discrepancies + 7/30-day rankings.
--
-- Fix:
--   - Prefer the latest 'closing' count of the shop day if present;
--   - Otherwise fall back to the latest 'spot' count of the shop day (after any
--     opening count so w_end is never earlier than w_start).
--   - Preserves the exact RETURNS TABLE signature for all existing callers
--     (StockReconciliationPage, StockCountPage, telegram-report).
--   - Does NOT change stock_deduction_settings.mode (stays 'shadow').
-- ==============================================================================

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
        LEFT JOIN op ON op.stock_item_id = l.stock_item_id
        WHERE s.shop_day = p_day
          AND s.kind IN ('closing', 'spot')
          AND (op.created_at IS NULL OR s.created_at >= op.created_at)
        ORDER BY l.stock_item_id, (s.kind = 'closing') DESC, s.created_at DESC
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

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION public.stock_daily_reconciliation(DATE) FROM PUBLIC, anon;
        GRANT EXECUTE ON FUNCTION public.stock_daily_reconciliation(DATE) TO authenticated, service_role;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
