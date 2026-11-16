-- Migration: 20261116124000_staff_adjust_order_item.sql
-- Description: Staff phone remote, phase 2. A signed-in staff member lowers the quantity of an
-- item on an open bill, or removes it, from the phone. Same rule as the POS: an item whose
-- kitchen/bar slip was already printed needs a reason (not_made / made_wasted) and is recorded
-- through log_order_item_removal; an item that was never printed is simply changed.
-- Raising a quantity is not done here: the phone sends a new order line (submit_staff_order),
-- which the POS prints like any other new item.
--
-- The cancel / reduce slip is printed by the POS terminal, which holds the printer. Removals made
-- from a phone are marked source = 'staff_remote'; the POS claims them, prints, and settles the
-- claim (claim_staff_removal_slips / settle_staff_removal_slips), so a slip is printed once even
-- with several terminals and is retried when the POS was off.
-- This function never closes a bill and never touches shifts or payments. Safe to re-run.

ALTER TABLE public.order_item_removals
    ADD COLUMN IF NOT EXISTS source TEXT,
    ADD COLUMN IF NOT EXISTS removed_by_id UUID,
    ADD COLUMN IF NOT EXISTS table_name TEXT,
    ADD COLUMN IF NOT EXISTS destination TEXT,
    ADD COLUMN IF NOT EXISTS slip_claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS slip_claimed_by TEXT,
    ADD COLUMN IF NOT EXISTS slip_printed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_order_item_removals_staff_slip
    ON public.order_item_removals (removed_at)
    WHERE source = 'staff_remote' AND slip_printed_at IS NULL;

CREATE OR REPLACE FUNCTION public.staff_adjust_order_item(
    p_order_item_id BIGINT,
    p_new_quantity INT,
    p_reason TEXT DEFAULT NULL,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_staff RECORD;
    v_staff_name TEXT;
    v_item RECORD;
    v_booking RECORD;
    v_table_name TEXT;
    v_item_name TEXT;
    v_before INT;
    v_after INT;
    v_removed INT;
    v_sent BOOLEAN;
    v_log JSONB;
    v_removal_id BIGINT := NULL;
    v_total NUMERIC(12, 2) := 0.00;
BEGIN
    -- A. Caller must be a signed-in staff account
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_SIGNED_IN');
    END IF;

    SELECT id, role, display_name, admin_permissions INTO v_staff
    FROM public.profiles
    WHERE id = v_uid;

    IF NOT FOUND OR NOT (
        COALESCE(v_staff.role, '') IN ('owner', 'admin', 'manager', 'staff', 'cashier', 'kitchen', 'custom')
        OR COALESCE(v_staff.admin_permissions::text, '') NOT IN ('', '[]', '{}', 'null')
    ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_STAFF');
    END IF;
    v_staff_name := COALESCE(NULLIF(TRIM(v_staff.display_name), ''), 'Staff');

    -- B. The item and its bill, both locked
    SELECT * INTO v_item
    FROM public.order_items
    WHERE id = p_order_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'ITEM_GONE');
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = v_item.booking_id
    FOR UPDATE;

    IF NOT FOUND OR v_booking.status NOT IN ('pending', 'confirmed', 'seated', 'ready') THEN
        RETURN jsonb_build_object('success', false, 'code', 'BILL_CLOSED');
    END IF;

    SELECT table_name INTO v_table_name FROM public.tables_layout WHERE id = v_booking.table_id;

    v_before := COALESCE(v_item.quantity, 1);
    v_after := GREATEST(COALESCE(p_new_quantity, 0), 0);
    v_removed := v_before - v_after;

    IF v_removed <= 0 THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOTHING_TO_REMOVE');
    END IF;

    SELECT name INTO v_item_name FROM public.menu_items WHERE id = v_item.menu_item_id;
    v_item_name := COALESCE(NULLIF(v_item.custom_name, ''), v_item_name, 'รายการ');

    -- C. Already sent to the kitchen or bar (printed, or being printed right now): needs a reason
    v_sent := v_item.kitchen_printed_at IS NOT NULL OR v_item.kitchen_print_claimed_at IS NOT NULL;

    IF v_sent THEN
        IF p_reason IS NULL OR p_reason NOT IN ('not_made', 'made_wasted') THEN
            RETURN jsonb_build_object('success', false, 'code', 'REASON_REQUIRED');
        END IF;

        v_log := public.log_order_item_removal(p_order_item_id, v_after, p_reason, v_staff_name, p_note);
        v_removal_id := NULLIF(v_log->>'removal_id', '')::BIGINT;

        UPDATE public.order_item_removals
        SET source = 'staff_remote',
            removed_by_id = v_uid,
            table_name = v_table_name,
            destination = COALESCE(v_item.destination, 'kitchen'),
            item_name = COALESCE(item_name, v_item_name)
        WHERE id = v_removal_id;
    END IF;

    -- D. Change the bill
    IF v_after = 0 THEN
        DELETE FROM public.order_items WHERE id = p_order_item_id;
    ELSE
        UPDATE public.order_items SET quantity = v_after WHERE id = p_order_item_id;
    END IF;

    SELECT COALESCE(SUM(COALESCE(price_at_time, 0.00) * COALESCE(quantity, 1)), 0.00) INTO v_total
    FROM public.order_items
    WHERE booking_id = v_booking.id;

    UPDATE public.bookings
    SET total_amount = v_total,
        updated_at = NOW()
    WHERE id = v_booking.id;

    -- E. Audit trail
    INSERT INTO public.pos_audit_logs (
        shift_id, staff_id, staff_name, action_type, booking_id, amount, reason, metadata
    ) VALUES (
        NULL, v_uid, v_staff_name,
        CASE WHEN v_after = 0 THEN 'staff_remote_void_item' ELSE 'staff_remote_reduce_item' END,
        v_booking.id,
        COALESCE(v_item.price_at_time, 0.00) * v_removed,
        CASE WHEN v_after = 0 THEN 'ยกเลิกรายการจากมือถือ: ' ELSE 'ลดจำนวนจากมือถือ: ' END
            || v_item_name || ' (' || v_before || ' → ' || v_after || ')'
            || COALESCE(' · โต๊ะ ' || v_table_name, ''),
        jsonb_build_object(
            'module', 'staff_remote',
            'order_item_id', p_order_item_id,
            'item_name', v_item_name,
            'quantity_before', v_before,
            'quantity_after', v_after,
            'removal_reason', p_reason,
            'removal_id', v_removal_id,
            'note', NULLIF(TRIM(COALESCE(p_note, '')), ''),
            'was_sent', v_sent,
            'table_id', v_booking.table_id,
            'table_name', v_table_name
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_booking.id,
        'table_id', v_booking.table_id,
        'quantity_before', v_before,
        'quantity_after', v_after,
        'removal_id', v_removal_id,
        'needs_slip', v_sent,
        'total_amount', v_total
    );
END;
$$;

-- The POS claims phone removals that still need a cancel / reduce slip.
-- A claim older than 45 seconds is treated as abandoned (the terminal crashed mid-print).
CREATE OR REPLACE FUNCTION public.claim_staff_removal_slips(p_device TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows JSONB;
BEGIN
    WITH claimed AS (
        UPDATE public.order_item_removals r
        SET slip_claimed_at = NOW(),
            slip_claimed_by = p_device
        WHERE r.id IN (
            SELECT id
            FROM public.order_item_removals
            WHERE source = 'staff_remote'
              AND slip_printed_at IS NULL
              AND cancelled_at IS NULL
              AND removed_at > NOW() - INTERVAL '6 hours'
              AND (slip_claimed_at IS NULL OR slip_claimed_at < NOW() - INTERVAL '45 seconds')
            ORDER BY id
            LIMIT 20
            FOR UPDATE SKIP LOCKED
        )
        RETURNING r.*
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'order_item_id', c.order_item_id,
        'booking_id', c.booking_id,
        'menu_item_id', c.menu_item_id,
        'item_name', c.item_name,
        'quantity_removed', c.quantity_removed,
        'quantity_after', c.quantity_after,
        'unit_price', c.unit_price,
        'selected_options', c.selected_options,
        'reason', c.reason,
        'removed_by', c.removed_by,
        'note', c.note,
        'table_name', c.table_name,
        'destination', c.destination,
        'removed_at', c.removed_at
    ) ORDER BY c.id), '[]'::jsonb)
    INTO v_rows
    FROM claimed c;

    RETURN v_rows;
END;
$$;

-- After printing: mark the slips printed, or give the claim back so the next attempt retries.
CREATE OR REPLACE FUNCTION public.settle_staff_removal_slips(p_ids BIGINT[], p_device TEXT, p_printed BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_printed THEN
        UPDATE public.order_item_removals
        SET slip_printed_at = NOW()
        WHERE id = ANY(p_ids) AND slip_printed_at IS NULL;
    ELSE
        UPDATE public.order_item_removals
        SET slip_claimed_at = NULL,
            slip_claimed_by = NULL
        WHERE id = ANY(p_ids) AND slip_printed_at IS NULL AND slip_claimed_by = p_device;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_adjust_order_item(BIGINT, INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_adjust_order_item(BIGINT, INT, TEXT, TEXT) TO authenticated, service_role;

-- The POS signs in with a staff PIN only, so it reaches the database as anon (same as the print-claim functions).
REVOKE ALL ON FUNCTION public.claim_staff_removal_slips(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_staff_removal_slips(TEXT) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.settle_staff_removal_slips(BIGINT[], TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_staff_removal_slips(BIGINT[], TEXT, BOOLEAN) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
