-- ==============================================================================
-- Migration: Count sessions (opening / spot / closing) and daily reconciliation
-- (Stock roadmap · Phase 3–4, runs after 20261114150000)
-- Date: 2026-11-14
--
-- Answers, per item and shop day:
--   opening count + received + produced - used in production - waste
--   - sales usage (from sale_stock_shadow) = expected close
--   expected close vs closing count = variance (units and baht)
--
-- Shop day: 05:00 to 05:00 Asia/Bangkok, so late-night sales belong to the
-- evening they started in.
-- Counting is atomic: every line is written to the ledger (count_adjust) under
-- the session id and kept with the system quantity it replaced.
-- Safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Which items are counted every day
-- ------------------------------------------------------------------------------
ALTER TABLE public.stock_items
    ADD COLUMN IF NOT EXISTS track_mode TEXT NOT NULL DEFAULT 'weekly';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_items_track_mode_check') THEN
        ALTER TABLE public.stock_items
            ADD CONSTRAINT stock_items_track_mode_check CHECK (track_mode IN ('daily', 'weekly', 'none'));
    END IF;
END $$;

COMMENT ON COLUMN public.stock_items.track_mode IS 'daily = counted at opening and closing; weekly = counted weekly; none = not counted (expensed)';

-- ------------------------------------------------------------------------------
-- 2. Shop day helpers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_shop_day(p_at TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT ((p_at AT TIME ZONE 'Asia/Bangkok') - interval '5 hours')::date;
$$;

CREATE OR REPLACE FUNCTION public.stock_shop_day_start(p_day DATE)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT (p_day::timestamp + interval '5 hours') AT TIME ZONE 'Asia/Bangkok';
$$;

-- Cost of one counted unit (bottle, kg, bag, portion).
CREATE OR REPLACE FUNCTION public.stock_count_unit_cost(p_item public.stock_items)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN p_item.item_type = 'prep' THEN COALESCE(p_item.cost_price, 0)::numeric
        ELSE COALESCE(p_item.cost_price, 0)::numeric
             / NULLIF(COALESCE(NULLIF(p_item.pack_size, 0), 1)::numeric
                      * COALESCE(NULLIF(p_item.conversion_factor, 0), 1)::numeric, 0)
             * public.stock_usage_per_count_unit(p_item)
    END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Count sessions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_count_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (kind IN ('opening', 'spot', 'closing')),
    shop_day DATE NOT NULL,
    blind BOOLEAN NOT NULL DEFAULT false,
    performed_by TEXT,
    note TEXT,
    line_count INT NOT NULL DEFAULT 0,
    value_diff NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_count_sessions_day ON public.stock_count_sessions (shop_day, kind, created_at DESC);

CREATE TABLE IF NOT EXISTS public.stock_count_lines (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.stock_count_sessions(id) ON DELETE CASCADE,
    stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
    system_qty NUMERIC(14,4),
    counted_qty NUMERIC(14,4) NOT NULL,
    diff NUMERIC(14,4),
    unit_cost NUMERIC(14,4),
    value_diff NUMERIC(14,2),
    note TEXT,
    UNIQUE (session_id, stock_item_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_count_lines_item ON public.stock_count_lines (stock_item_id);

-- p_lines: [{ "stock_item_id": uuid, "counted_qty": number, "note": text? }]
CREATE OR REPLACE FUNCTION public.submit_stock_count(
    p_kind TEXT,
    p_lines JSONB,
    p_performed_by TEXT DEFAULT 'Staff',
    p_note TEXT DEFAULT NULL,
    p_blind BOOLEAN DEFAULT false,
    p_shop_day DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ------------------------------------------------------------------------------
-- 4. Daily reconciliation
-- ------------------------------------------------------------------------------
-- Window per item: from its opening count (or 05:00) to its closing count (or 05:00 next day).
-- Sales usage comes from sale_stock_shadow until live deduction exists.
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
         AND s.sold_at > w.w_start AND s.sold_at <= w.w_end
        GROUP BY w.id
    )
    SELECT i.id, i.name, i.category, i.unit, i.item_type, i.track_mode,
           round(COALESCE(w.op_qty, b.qty), 4),
           CASE WHEN w.op_qty IS NOT NULL THEN 'count' ELSE 'ledger' END,
           round(COALESCE(m.received, 0), 4),
           round(COALESCE(m.produced, 0), 4),
           round(-COALESCE(m.used_prod, 0), 4),
           round(-COALESCE(m.waste, 0), 4),
           round(-COALESCE(m.other_out, 0), 4),
           round(COALESCE(sa.qty, 0), 4),
           round(COALESCE(w.op_qty, b.qty) + COALESCE(m.received, 0) + COALESCE(m.produced, 0)
                 + COALESCE(m.used_prod, 0) + COALESCE(m.waste, 0) + COALESCE(m.other_out, 0)
                 - COALESCE(sa.qty, 0), 4),
           w.cl_qty,
           w.cl_at,
           CASE WHEN w.cl_qty IS NULL THEN NULL ELSE round(w.cl_qty - (
                COALESCE(w.op_qty, b.qty) + COALESCE(m.received, 0) + COALESCE(m.produced, 0)
                + COALESCE(m.used_prod, 0) + COALESCE(m.waste, 0) + COALESCE(m.other_out, 0)
                - COALESCE(sa.qty, 0)), 4) END,
           round(public.stock_count_unit_cost(i::public.stock_items), 4),
           CASE WHEN w.cl_qty IS NULL THEN NULL ELSE round((w.cl_qty - (
                COALESCE(w.op_qty, b.qty) + COALESCE(m.received, 0) + COALESCE(m.produced, 0)
                + COALESCE(m.used_prod, 0) + COALESCE(m.waste, 0) + COALESCE(m.other_out, 0)
                - COALESCE(sa.qty, 0))) * public.stock_count_unit_cost(i::public.stock_items), 2) END
    FROM items i
    JOIN win w ON w.id = i.id
    JOIN bal b ON b.id = i.id
    LEFT JOIN mv m ON m.id = i.id
    LEFT JOIN sales sa ON sa.id = i.id
    WHERE i.track_mode = 'daily'
       OR w.op_qty IS NOT NULL OR w.cl_qty IS NOT NULL
       OR m.id IS NOT NULL OR sa.id IS NOT NULL;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Access: staff sign in to count; writes only through submit_stock_count
-- ------------------------------------------------------------------------------
ALTER TABLE public.stock_count_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_lines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        RETURN;
    END IF;
    DROP POLICY IF EXISTS stock_count_sessions_read ON public.stock_count_sessions;
    CREATE POLICY stock_count_sessions_read ON public.stock_count_sessions FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS stock_count_lines_read ON public.stock_count_lines;
    CREATE POLICY stock_count_lines_read ON public.stock_count_lines FOR SELECT TO authenticated USING (true);

    REVOKE ALL ON FUNCTION public.submit_stock_count(TEXT, JSONB, TEXT, TEXT, BOOLEAN, DATE) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.submit_stock_count(TEXT, JSONB, TEXT, TEXT, BOOLEAN, DATE) TO authenticated, service_role;
    REVOKE ALL ON FUNCTION public.stock_daily_reconciliation(DATE) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.stock_daily_reconciliation(DATE) TO authenticated, service_role;
END $$;

NOTIFY pgrst, 'reload schema';
