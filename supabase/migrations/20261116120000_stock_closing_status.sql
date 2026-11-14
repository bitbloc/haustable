-- ==============================================================================
-- Has the stock closing count been done today? (for the POS shift close)
--
-- The POS signs in with a staff PIN only (anon), so it cannot read
-- stock_count_sessions. This function answers just the question it needs:
-- whether a closing count exists for a shop day, how many items, and when.
-- No item names or quantities are exposed. Closing the cash shift is never
-- blocked; the POS only shows a reminder.
-- Safe to re-run.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.stock_closing_status(p_day DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_day DATE := COALESCE(p_day, public.stock_shop_day(now()));
    v_items INT;
    v_last TIMESTAMPTZ;
BEGIN
    SELECT count(DISTINCT l.stock_item_id), max(s.created_at)
    INTO v_items, v_last
    FROM public.stock_count_sessions s
    LEFT JOIN public.stock_count_lines l ON l.session_id = s.id
    WHERE s.shop_day = v_day AND s.kind = 'closing';

    RETURN jsonb_build_object(
        'shop_day', v_day,
        'counted', v_last IS NOT NULL,
        'items', COALESCE(v_items, 0),
        'last_at', v_last
    );
END;
$$;

REVOKE ALL ON FUNCTION public.stock_closing_status(DATE) FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        GRANT EXECUTE ON FUNCTION public.stock_closing_status(DATE) TO anon, authenticated, service_role;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
