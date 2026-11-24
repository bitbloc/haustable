-- Sale shadow: keep "made, then wasted" rows, and stop counting voided bills
-- (audit 2026-11-24, findings 2 and 4)
--
-- 1. record_sale_stock_shadow lost its "source IN ('recipe','option')" filter when
--    20261123183000 rewrote it, so recomputing a bill line also voided the waste rows that
--    log_order_item_removal had just written for it. Waste then showed up in the
--    reconciliation as an unexplained shortage. The filter is back.
--
-- 2. A bill is voided or cancelled by changing bookings.status only; order_items are not
--    touched, so its recipe usage stayed in the shadow and the reconciliation showed a
--    false surplus. Now:
--      * record_sale_stock_shadow writes no usage for a line whose bill is void/cancelled
--        (this also covers rebuild_sale_stock_shadow, which calls it per line);
--      * a trigger on bookings recomputes the bill's lines when its status crosses into or
--        out of void/cancelled. It never blocks the status change: an error is logged to
--        stock_deduction_errors instead.
--    Waste rows are left alone either way: what was made and thrown away was really used.
--
-- 3. One-off repair: void the usage still open on bills already void/cancelled, and write
--    back the waste rows of removals that lost them.

BEGIN;

CREATE OR REPLACE FUNCTION public.record_sale_stock_shadow(
    p_order_item_id bigint,
    p_booking_id uuid,
    p_menu_item_id bigint,
    p_quantity numeric,
    p_options jsonb,
    p_sold_at timestamp with time zone,
    p_is_deleted boolean DEFAULT false,
    p_item_channel text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_is_takeaway BOOLEAN;
    v_bill_status TEXT;
BEGIN
    -- Recomputing a sale line must not touch the waste recorded for it.
    UPDATE public.sale_stock_shadow
    SET voided_at = now()
    WHERE order_item_id = p_order_item_id AND voided_at IS NULL
      AND source IN ('recipe', 'option');

    IF p_is_deleted OR p_menu_item_id IS NULL THEN
        RETURN;
    END IF;

    -- A voided or cancelled bill sold nothing.
    IF p_booking_id IS NOT NULL THEN
        SELECT lower(COALESCE(b.status, '')) INTO v_bill_status
        FROM public.bookings b WHERE b.id = p_booking_id;
        IF v_bill_status IN ('void', 'cancelled') THEN
            RETURN;
        END IF;
    END IF;

    v_is_takeaway := public.is_takeaway_sale(p_booking_id, p_item_channel);

    INSERT INTO public.sale_stock_shadow
        (order_item_id, booking_id, menu_item_id, stock_item_id, source, quantity, order_quantity, sold_at)
    SELECT p_order_item_id, p_booking_id, p_menu_item_id, r.stock_item_id, r.source,
           round(SUM(r.stock_qty), 4), p_quantity, COALESCE(p_sold_at, now())
    FROM public.stock_requirements_for_sale(p_menu_item_id, COALESCE(p_quantity, 1), p_options, v_is_takeaway) r
    GROUP BY r.stock_item_id, r.source
    HAVING round(SUM(r.stock_qty), 4) <> 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_sale_stock_shadow(bigint, uuid, bigint, numeric, jsonb, timestamptz, boolean, text)
    FROM PUBLIC, anon, authenticated;

-- Bill status crosses void/cancelled: recompute that bill's lines.
CREATE OR REPLACE FUNCTION public.trg_fn_booking_status_stock_shadow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_mode TEXT;
    v_was BOOLEAN := lower(COALESCE(OLD.status, '')) IN ('void', 'cancelled');
    v_is BOOLEAN := lower(COALESCE(NEW.status, '')) IN ('void', 'cancelled');
    v_row JSONB;
BEGIN
    IF v_was = v_is THEN
        RETURN NULL;
    END IF;

    SELECT mode INTO v_mode FROM public.stock_deduction_settings WHERE id;
    IF COALESCE(v_mode, 'off') = 'off' THEN
        RETURN NULL;
    END IF;

    BEGIN
        FOR v_row IN SELECT to_jsonb(oi) FROM public.order_items oi WHERE oi.booking_id = NEW.id
        LOOP
            PERFORM public.record_sale_stock_shadow(
                (v_row->>'id')::bigint,
                NEW.id,
                CASE WHEN COALESCE((v_row->>'is_custom')::boolean, false) THEN NULL
                     ELSE NULLIF(v_row->>'menu_item_id', '')::bigint END,
                COALESCE(NULLIF(v_row->>'quantity', '')::numeric, 1),
                v_row->'selected_options',
                NULLIF(v_row->>'created_at', '')::timestamptz,
                COALESCE(v_row->>'status', '') IN ('void', 'cancelled'),
                NULLIF(v_row->>'channel', ''));
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        -- Voiding a bill must never fail because of stock bookkeeping.
        INSERT INTO public.stock_deduction_errors (order_item_id, message)
        VALUES (NULL, 'bill ' || NEW.id::text || ' status change: ' || left(SQLERRM, 400));
    END;
    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.trg_fn_booking_status_stock_shadow() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_booking_status_stock_shadow ON public.bookings;
CREATE TRIGGER trg_booking_status_stock_shadow
    AFTER UPDATE OF status ON public.bookings
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.trg_fn_booking_status_stock_shadow();

-- Repair 1: usage still open on bills that are already void / cancelled.
UPDATE public.sale_stock_shadow s
SET voided_at = now()
FROM public.bookings b
WHERE b.id = s.booking_id
  AND lower(COALESCE(b.status, '')) IN ('void', 'cancelled')
  AND s.voided_at IS NULL
  AND s.source IN ('recipe', 'option');

-- Repair 2: "made, then wasted" removals whose waste rows were voided or never survived.
UPDATE public.sale_stock_shadow s
SET voided_at = NULL
FROM public.order_item_removals r
WHERE s.removal_id = r.id
  AND s.source = 'waste'
  AND s.voided_at IS NOT NULL
  AND r.reason = 'made_wasted'
  AND r.cancelled_at IS NULL;

INSERT INTO public.sale_stock_shadow
    (order_item_id, booking_id, menu_item_id, stock_item_id, source, quantity, order_quantity, sold_at, removal_id)
SELECT r.order_item_id, r.booking_id, r.menu_item_id, q.stock_item_id, 'waste',
       round(SUM(q.stock_qty), 4), r.quantity_removed, r.removed_at, r.id
FROM public.order_item_removals r
CROSS JOIN LATERAL public.stock_requirements_for_sale(
    r.menu_item_id, r.quantity_removed, r.selected_options, false) q
WHERE r.reason = 'made_wasted'
  AND r.cancelled_at IS NULL
  AND r.menu_item_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.sale_stock_shadow s WHERE s.removal_id = r.id)
GROUP BY r.id, r.order_item_id, r.booking_id, r.menu_item_id, r.quantity_removed, r.removed_at, q.stock_item_id
HAVING round(SUM(q.stock_qty), 4) <> 0;

COMMIT;
