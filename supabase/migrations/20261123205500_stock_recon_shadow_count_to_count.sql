-- ==============================================================================
-- Stock Daily Reconciliation: Count-to-Count Carryover in Shadow Mode
--
-- Problem:
--   While stock_deduction_settings.mode = 'shadow', sales are recorded only in
--   sale_stock_shadow and do NOT deduct stock_transactions. Previously, when
--   staff did not count an item every day (e.g., counting every 3-7 days),
--   opening_qty read the raw ledger balance (without prior days' shadow sales)
--   while sales_usage subtracted only the current day's sales, producing false
--   shortages equal to all skipped days' sales.
--
-- Fix:
--   When mode = 'shadow' and an item has no explicit opening count or mid-day
--   opening baseline on p_day:
--     1. Locate the item's last physical anchor before p_day 05:00 Bangkok:
--        the latest stock_count_lines timestamp OR latest reset transaction
--        (reason IN ('count_adjust', 'opening') OR transaction_type = 'set'),
--        falling back to its earliest transaction if never counted/set.
--     2. Sum un-deducted sale_stock_shadow rows (recipe, option, waste) in
--        (anchor_at, w_start] as prior_shadow.
--     3. Effective opening_qty = ledger balance at w_start - prior_shadow.
--        opening_source = 'shadow_carry' when prior_shadow > 0, else 'ledger'.
--   When mode is 'live' or 'off', prior_shadow is 0 (live mode already deducts
--   stock_transactions directly).
--
-- Companion RPC:
--   public.stock_shadow_carryover(p_day DATE) exposes anchor_at, anchor_kind,
--   raw_opening_qty, prior_shadow_usage, and days_since_anchor for transparent
--   display in StockReconciliationPage without altering stock_daily_reconciliation's
--   20-column RETURNS TABLE signature.
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
    v_end   TIMESTAMPTZ := public.stock_shop_day_start(p_day + 1);
    v_mode  TEXT;
BEGIN
    SELECT COALESCE((SELECT mode FROM public.stock_deduction_settings WHERE id), 'shadow')
      INTO v_mode;

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
        SELECT w.id,
               COALESCE(SUM(t.quantity_change), 0)::numeric AS qty,
               COALESCE(BOOL_OR(t.reason = 'opening' AND t.created_at > w.w_start AND t.created_at <= w.w_end), false) AS has_day_opening
        FROM win w
        LEFT JOIN public.stock_transactions t
          ON t.stock_item_id = w.id
         AND (t.created_at <= w.w_start
              OR (t.reason = 'opening' AND t.created_at <= w.w_end))
        GROUP BY w.id
    ),
    -- Last physical sync point before w_start (count or set/opening reset, else first tx).
    prev_anchor AS (
        SELECT w.id,
               COALESCE(
                   GREATEST(
                       (SELECT MAX(s.created_at)
                          FROM public.stock_count_lines l
                          JOIN public.stock_count_sessions s ON s.id = l.session_id
                         WHERE l.stock_item_id = w.id AND s.created_at <= w.w_start),
                       (SELECT MAX(t.created_at)
                          FROM public.stock_transactions t
                         WHERE t.stock_item_id = w.id
                           AND (t.reason IN ('count_adjust', 'opening') OR t.transaction_type = 'set')
                           AND t.created_at <= w.w_start)
                   ),
                   (SELECT MIN(t.created_at)
                      FROM public.stock_transactions t
                     WHERE t.stock_item_id = w.id AND t.created_at <= w.w_start)
               ) AS anchor_at
        FROM win w
        WHERE v_mode = 'shadow' AND w.op_qty IS NULL
    ),
    -- Un-deducted shadow usage between the last physical anchor and today's 05:00 window start.
    prior_sh AS (
        SELECT pa.id, COALESCE(SUM(s.quantity), 0)::numeric AS qty
        FROM prev_anchor pa
        JOIN win w ON w.id = pa.id
        JOIN bal b ON b.id = pa.id
        JOIN public.sale_stock_shadow s
          ON s.stock_item_id = pa.id
         AND s.voided_at IS NULL
         AND s.source IN ('recipe', 'option', 'waste')
         AND s.sold_at > pa.anchor_at
         AND s.sold_at <= w.w_start
        WHERE v_mode = 'shadow'
          AND pa.anchor_at IS NOT NULL
          AND NOT b.has_day_opening
        GROUP BY pa.id
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
    ),
    eff AS (
        SELECT i.id,
               COALESCE(w.op_qty, b.qty - COALESCE(ps.qty, 0)) AS eff_open,
               CASE
                   WHEN w.op_qty IS NOT NULL THEN 'count'
                   WHEN COALESCE(ps.qty, 0) > 0 THEN 'shadow_carry'
                   ELSE 'ledger'
               END AS eff_open_source
        FROM items i
        JOIN win w ON w.id = i.id
        JOIN bal b ON b.id = i.id
        LEFT JOIN prior_sh ps ON ps.id = i.id
    )
    SELECT i.id, i.name, i.category, i.unit, i.item_type, i.track_mode,
           round(e.eff_open, 4),
           e.eff_open_source,
           round(COALESCE(m.received, 0), 4),
           round(COALESCE(m.produced, 0), 4),
           round(-COALESCE(m.used_prod, 0), 4),
           round(-(COALESCE(m.waste, 0) - COALESCE(sx.qty, 0)), 4),
           round(-COALESCE(m.other_out, 0), 4),
           round(COALESCE(sa.qty, 0), 4),
           round(e.eff_open + COALESCE(m.received, 0) + COALESCE(m.produced, 0)
                 + COALESCE(m.used_prod, 0) + (COALESCE(m.waste, 0) - COALESCE(sx.qty, 0)) + COALESCE(m.other_out, 0)
                 - COALESCE(sa.qty, 0), 4),
           w.cl_qty,
           w.cl_at,
           CASE WHEN w.cl_qty IS NULL THEN NULL ELSE round(w.cl_qty - (
                e.eff_open + COALESCE(m.received, 0) + COALESCE(m.produced, 0)
                + COALESCE(m.used_prod, 0) + (COALESCE(m.waste, 0) - COALESCE(sx.qty, 0)) + COALESCE(m.other_out, 0)
                - COALESCE(sa.qty, 0)), 4) END,
           round(public.stock_count_unit_cost(i::public.stock_items), 4),
           CASE WHEN w.cl_qty IS NULL THEN NULL ELSE round((w.cl_qty - (
                e.eff_open + COALESCE(m.received, 0) + COALESCE(m.produced, 0)
                + COALESCE(m.used_prod, 0) + (COALESCE(m.waste, 0) - COALESCE(sx.qty, 0)) + COALESCE(m.other_out, 0)
                - COALESCE(sa.qty, 0))) * public.stock_count_unit_cost(i::public.stock_items), 2) END
    FROM items i
    JOIN win w ON w.id = i.id
    JOIN eff e ON e.id = i.id
    LEFT JOIN mv m ON m.id = i.id
    LEFT JOIN sales sa ON sa.id = i.id
    LEFT JOIN sw sx ON sx.id = i.id
    WHERE i.track_mode = 'daily'
       OR w.op_qty IS NOT NULL OR w.cl_qty IS NOT NULL
       OR m.id IS NOT NULL OR sa.id IS NOT NULL OR sx.id IS NOT NULL;
END;
$$;

-- Companion RPC: return carryover metadata per item on p_day so the Admin UI can
-- show exactly how much prior shadow usage was carried forward and since which date.
CREATE OR REPLACE FUNCTION public.stock_shadow_carryover(p_day DATE)
RETURNS TABLE (
    stock_item_id UUID,
    anchor_at TIMESTAMPTZ,
    anchor_kind TEXT,
    raw_opening_qty NUMERIC,
    prior_shadow_usage NUMERIC,
    days_since_anchor INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_start TIMESTAMPTZ := public.stock_shop_day_start(p_day);
    v_end   TIMESTAMPTZ := public.stock_shop_day_start(p_day + 1);
    v_mode  TEXT;
BEGIN
    SELECT COALESCE((SELECT mode FROM public.stock_deduction_settings WHERE id), 'shadow')
      INTO v_mode;

    IF v_mode <> 'shadow' THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH items AS (
        SELECT si.id
        FROM public.stock_items si
        WHERE (si.item_type = 'raw' OR (si.item_type = 'prep' AND si.prep_mode = 'stocked'))
          AND si.track_mode <> 'none'
    ),
    op AS (
        SELECT DISTINCT l.stock_item_id
        FROM public.stock_count_lines l
        JOIN public.stock_count_sessions s ON s.id = l.session_id
        WHERE s.shop_day = p_day AND s.kind = 'opening'
    ),
    anchors AS (
        SELECT i.id,
               (SELECT MAX(s.created_at)
                  FROM public.stock_count_lines l
                  JOIN public.stock_count_sessions s ON s.id = l.session_id
                 WHERE l.stock_item_id = i.id AND s.created_at <= v_start) AS max_count_at,
               (SELECT MAX(t.created_at)
                  FROM public.stock_transactions t
                 WHERE t.stock_item_id = i.id
                   AND (t.reason IN ('count_adjust', 'opening') OR t.transaction_type = 'set')
                   AND t.created_at <= v_start) AS max_reset_at,
               (SELECT MIN(t.created_at)
                  FROM public.stock_transactions t
                 WHERE t.stock_item_id = i.id AND t.created_at <= v_start) AS min_tx_at,
               EXISTS (
                   SELECT 1 FROM public.stock_transactions t
                    WHERE t.stock_item_id = i.id
                      AND t.reason = 'opening'
                      AND t.created_at > v_start AND t.created_at <= v_end
               ) AS has_day_opening
        FROM items i
        LEFT JOIN op ON op.stock_item_id = i.id
        WHERE op.stock_item_id IS NULL
    ),
    resolved AS (
        SELECT a.id,
               COALESCE(GREATEST(a.max_count_at, a.max_reset_at), a.min_tx_at) AS anchor_at,
               CASE
                   WHEN a.max_count_at IS NOT NULL AND (a.max_reset_at IS NULL OR a.max_count_at >= a.max_reset_at) THEN 'count'
                   WHEN a.max_reset_at IS NOT NULL THEN 'reset'
                   WHEN a.min_tx_at IS NOT NULL THEN 'purchase'
                   ELSE NULL
               END AS anchor_kind
        FROM anchors a
        WHERE NOT a.has_day_opening
    ),
    bal AS (
        SELECT r.id, COALESCE(SUM(t.quantity_change), 0)::numeric AS qty
        FROM resolved r
        LEFT JOIN public.stock_transactions t
          ON t.stock_item_id = r.id AND t.created_at <= v_start
        GROUP BY r.id
    ),
    prior_sh AS (
        SELECT r.id, COALESCE(SUM(s.quantity), 0)::numeric AS qty
        FROM resolved r
        JOIN public.sale_stock_shadow s
          ON s.stock_item_id = r.id
         AND s.voided_at IS NULL
         AND s.source IN ('recipe', 'option', 'waste')
         AND s.sold_at > r.anchor_at
         AND s.sold_at <= v_start
        WHERE r.anchor_at IS NOT NULL
        GROUP BY r.id
    )
    SELECT r.id,
           r.anchor_at,
           r.anchor_kind,
           round(b.qty, 4),
           round(COALESCE(ps.qty, 0), 4),
           CASE
               WHEN r.anchor_at IS NULL THEN NULL
               ELSE GREATEST(0, (p_day - public.stock_shop_day(r.anchor_at))::integer)
           END
    FROM resolved r
    JOIN bal b ON b.id = r.id
    LEFT JOIN prior_sh ps ON ps.id = r.id
    WHERE r.anchor_at IS NOT NULL;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION public.stock_daily_reconciliation(DATE) FROM PUBLIC, anon;
        GRANT EXECUTE ON FUNCTION public.stock_daily_reconciliation(DATE) TO authenticated, service_role;

        REVOKE ALL ON FUNCTION public.stock_shadow_carryover(DATE) FROM PUBLIC, anon;
        GRANT EXECUTE ON FUNCTION public.stock_shadow_carryover(DATE) TO authenticated, service_role;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
