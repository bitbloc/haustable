-- Migration: 20261116123000_submit_staff_order.sql
-- Description: Staff phone remote (/staff/tables/:id). A signed-in staff member adds items to a
-- table's open bill, or opens a walk-in bill on an empty table. Sibling of submit_customer_qr_order,
-- with four differences:
--   1. only a signed-in staff account may call it, and the order records who placed it;
--   2. an existing bill's status, source and staff_remark are left alone (the POS keeps state in
--      staff_remark tags and rewrites the whole field);
--   3. prices come from menu_items / option_choices, not from the phone;
--   4. a repeated request (same p_request_id) is answered without inserting again.
-- Items are inserted with kitchen_printed_at NULL, so the POS terminal claims and prints the
-- kitchen/bar slips exactly as it does for customer QR orders. No VAT is added anywhere.
-- This function never closes a bill and never touches shifts or payments.

ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS ordered_by UUID,
    ADD COLUMN IF NOT EXISTS ordered_by_name TEXT,
    ADD COLUMN IF NOT EXISTS client_request_id UUID;

CREATE INDEX IF NOT EXISTS idx_order_items_client_request
    ON public.order_items (client_request_id)
    WHERE client_request_id IS NOT NULL;

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

REVOKE ALL ON FUNCTION public.submit_staff_order(INT, JSONB, UUID, INT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_staff_order(INT, JSONB, UUID, INT, UUID) TO authenticated, service_role;
