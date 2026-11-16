-- Migration: 20261116130000_staff_remote_requires_open_shift.sql
-- Description: The staff phone remote only works while a shift is open at the POS.
-- submit_staff_order and staff_adjust_order_item now answer NO_OPEN_SHIFT otherwise, so nothing is
-- ordered, printed or removed outside a shift (the POS prints incoming items even behind its PIN
-- screen, and a bill opened outside a shift would land in the next shift's sales).
-- A shift counts as open when pos_shifts has a row with status 'open' opened within the last 20
-- hours, the same freshness rule the POS uses (isShiftRecent in src/utils/shiftHelper.js).
-- The POS mirrors its shift to pos_shifts when it is online, so a shift opened while the POS is
-- offline is not seen here until it syncs.
-- Both functions are otherwise unchanged from 20261116123000 and 20261116124000. Safe to re-run.

CREATE OR REPLACE FUNCTION public.pos_has_open_shift()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.pos_shifts
        WHERE status = 'open'
          AND closed_at IS NULL
          AND opened_at > NOW() - INTERVAL '20 hours'
          AND opened_at < NOW() + INTERVAL '1 hour'
    );
$$;

REVOKE ALL ON FUNCTION public.pos_has_open_shift() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_has_open_shift() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_staff_order(
    p_table_id INT,
    p_items JSONB,
    p_expected_booking_id UUID DEFAULT NULL,
    p_pax INT DEFAULT NULL,
    p_request_id UUID DEFAULT NULL
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
    v_table RECORD;
    v_booking RECORD;
    v_booking_id UUID;
    v_is_new BOOLEAN := false;
    v_item JSONB;
    v_options JSONB;
    v_menu RECORD;
    v_bad_choice TEXT;
    v_opt_total NUMERIC(10, 2);
    v_qty INT;
    v_rows JSONB := '[]'::jsonb;
    v_items_count INT := 0;
    v_added NUMERIC(10, 2) := 0.00;
    v_total NUMERIC(10, 2) := 0.00;
BEGIN
    -- A. Caller must be a signed-in staff account (same roles StaffAuthLayout lets into /staff)
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

    -- The phone is a remote for the POS: no open shift at the POS, no orders or corrections from the phone
    IF NOT public.pos_has_open_shift() THEN
        RETURN jsonb_build_object('success', false, 'code', 'NO_OPEN_SHIFT');
    END IF;

    -- B. Table. The row lock serialises two phones ordering for the same table at once.
    SELECT id, table_name, capacity INTO v_table
    FROM public.tables_layout
    WHERE id = p_table_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'TABLE_NOT_FOUND');
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'code', 'EMPTY_ORDER');
    END IF;

    -- C. Same request sent twice (weak signal, double tap): answer with what the first one did
    IF p_request_id IS NOT NULL THEN
        SELECT booking_id INTO v_booking_id
        FROM public.order_items
        WHERE client_request_id = p_request_id
        LIMIT 1;

        IF FOUND THEN
            SELECT COALESCE(total_amount, 0.00) INTO v_total FROM public.bookings WHERE id = v_booking_id;
            RETURN jsonb_build_object(
                'success', true,
                'duplicate', true,
                'booking_id', v_booking_id,
                'table_id', p_table_id,
                'table_name', v_table.table_name,
                'total_amount', v_total,
                'items_count', 0,
                'is_new_booking', false
            );
        END IF;
    END IF;

    -- D. Find and lock the table's live bill
    IF p_expected_booking_id IS NOT NULL THEN
        -- The phone was showing this bill. If the POS closed or moved it meanwhile, say so
        -- instead of quietly opening a second bill on the table.
        SELECT * INTO v_booking
        FROM public.bookings
        WHERE id = p_expected_booking_id
          AND table_id = p_table_id
          AND status IN ('pending', 'confirmed', 'seated', 'ready')
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'code', 'BILL_CLOSED');
        END IF;
    ELSE
        SELECT * INTO v_booking
        FROM public.bookings
        WHERE table_id = p_table_id
          AND status IN ('pending', 'confirmed', 'seated', 'ready')
          AND (booking_time IS NULL OR booking_time >= NOW() - INTERVAL '16 hours')
          -- An unseated advance reservation is not a live table session yet
          AND NOT (status IN ('pending', 'confirmed') AND COALESCE(booking_type, '') = 'dine_in')
        ORDER BY (status = 'seated') DESC, booking_time DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF FOUND THEN
        -- The POS skips printing for bills still waiting for staff approval
        IF COALESCE(v_booking.staff_remark, '') LIKE '%[WAITING_APPROVAL]%' THEN
            RETURN jsonb_build_object('success', false, 'code', 'WAITING_APPROVAL');
        END IF;
        v_booking_id := v_booking.id;
    END IF;

    -- E. Validate and price every item before writing anything
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT id, name, price, is_available INTO v_menu
        FROM public.menu_items
        WHERE id = NULLIF(v_item->>'menu_item_id', '')::BIGINT;

        IF NOT FOUND OR v_menu.is_available IS FALSE THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'ITEM_UNAVAILABLE',
                'detail', COALESCE(v_menu.name, v_item->>'menu_item_id')
            );
        END IF;

        v_options := CASE
            WHEN jsonb_typeof(v_item->'selected_options') = 'array' THEN v_item->'selected_options'
            ELSE '[]'::jsonb
        END;

        SELECT oc.name INTO v_bad_choice
        FROM jsonb_array_elements(v_options) AS opt
        JOIN public.option_choices oc ON oc.id::text = opt->>'choice_id'
        WHERE oc.is_available IS FALSE
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'CHOICE_UNAVAILABLE',
                'detail', v_menu.name || ' · ' || v_bad_choice
            );
        END IF;

        SELECT COALESCE(SUM(COALESCE(oc.price_modifier, 0)), 0.00) INTO v_opt_total
        FROM jsonb_array_elements(v_options) AS opt
        JOIN public.option_choices oc ON oc.id::text = opt->>'choice_id';

        v_qty := LEAST(99, GREATEST(1, COALESCE(NULLIF(v_item->>'quantity', '')::INT, 1)));

        v_rows := v_rows || jsonb_build_object(
            'menu_item_id', v_menu.id,
            'quantity', v_qty,
            'price_at_time', COALESCE(v_menu.price, 0.00) + v_opt_total,
            'destination', CASE
                WHEN v_item->>'destination' IN ('kitchen', 'bar', 'other') THEN v_item->>'destination'
                ELSE 'kitchen'
            END,
            'selected_options', v_options
        );
        v_items_count := v_items_count + 1;
        v_added := v_added + (COALESCE(v_menu.price, 0.00) + v_opt_total) * v_qty;
    END LOOP;

    -- F. Empty table: open a walk-in bill, the way the POS and QR ordering do
    IF v_booking_id IS NULL THEN
        v_is_new := true;
        INSERT INTO public.bookings (
            table_id, status, booking_type, booking_time, pax, staff_remark,
            tracking_token, total_amount, source, created_at, updated_at
        ) VALUES (
            p_table_id, 'seated', 'walk_in', NOW(), COALESCE(p_pax, v_table.capacity, 2),
            '[STAFF] ' || v_staff_name,
            gen_random_uuid()::TEXT, 0.00, 'staff', NOW(), NOW()
        )
        RETURNING id INTO v_booking_id;
    END IF;

    -- G. Items. kitchen_printed_at stays NULL: the POS terminal claims and prints them.
    INSERT INTO public.order_items (
        booking_id, menu_item_id, quantity, price_at_time, destination,
        selected_options, status, created_at,
        ordered_by, ordered_by_name, client_request_id
    )
    SELECT
        v_booking_id,
        (r->>'menu_item_id')::BIGINT,
        (r->>'quantity')::INT,
        (r->>'price_at_time')::NUMERIC(10, 2),
        r->>'destination',
        r->'selected_options',
        'pending',
        NOW(),
        v_uid,
        v_staff_name,
        p_request_id
    FROM jsonb_array_elements(v_rows) AS r;

    -- H. Running total, the same raw sum the POS keeps while a bill is open
    SELECT COALESCE(SUM(COALESCE(price_at_time, 0.00) * COALESCE(quantity, 1)), 0.00) INTO v_total
    FROM public.order_items
    WHERE booking_id = v_booking_id;

    UPDATE public.bookings
    SET total_amount = v_total,
        updated_at = NOW()
    WHERE id = v_booking_id;

    -- I. Audit trail: who ordered what, from the phone
    INSERT INTO public.pos_audit_logs (
        shift_id, staff_id, staff_name, action_type, booking_id, amount, reason, metadata
    ) VALUES (
        NULL, v_uid, v_staff_name, 'staff_remote_order', v_booking_id, v_added,
        'สั่งจากมือถือพนักงาน: ' || v_table.table_name || ' (' || v_items_count || ' รายการ)',
        jsonb_build_object(
            'module', 'staff_remote',
            'table_id', p_table_id,
            'table_name', v_table.table_name,
            'items_count', v_items_count,
            'is_new_booking', v_is_new,
            'request_id', p_request_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'duplicate', false,
        'booking_id', v_booking_id,
        'table_id', p_table_id,
        'table_name', v_table.table_name,
        'total_amount', v_total,
        'added_amount', v_added,
        'items_count', v_items_count,
        'is_new_booking', v_is_new
    );
END;
$$;

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

    -- The phone is a remote for the POS: no open shift at the POS, no orders or corrections from the phone
    IF NOT public.pos_has_open_shift() THEN
        RETURN jsonb_build_object('success', false, 'code', 'NO_OPEN_SHIFT');
    END IF;

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

REVOKE ALL ON FUNCTION public.submit_staff_order(INT, JSONB, UUID, INT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_staff_order(INT, JSONB, UUID, INT, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.staff_adjust_order_item(BIGINT, INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_adjust_order_item(BIGINT, INT, TEXT, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
