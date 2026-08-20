-- Migration: 20260820000000_optimize_qr_order_realtime_rpc.sql
-- Description: High-Performance Atomic RPC for Customer QR Ordering with Instant Table Session Resolution & Total Recalculation

-- 1. Ensure source column exists safely on bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'pos';

-- 2. Optimized Compound Index for Sub-Millisecond Active Booking Lookup
CREATE INDEX IF NOT EXISTS idx_bookings_table_active_session 
ON public.bookings (table_id, status, booking_time DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_booking_pricing 
ON public.order_items (booking_id, price_at_time, quantity);

-- 3. Atomic QR Order Submission Function
CREATE OR REPLACE FUNCTION public.submit_customer_qr_order(
    p_table_id INT,
    p_items JSONB,
    p_user_id UUID DEFAULT NULL,
    p_pax INT DEFAULT 2,
    p_customer_note TEXT DEFAULT '',
    p_tracking_token TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_table_record RECORD;
    v_booking_id UUID := NULL;
    v_existing_booking RECORD;
    v_tracking_token TEXT;
    v_remark TEXT;
    v_total_amount NUMERIC(10, 2) := 0.00;
    v_items_count INT := 0;
    v_is_new BOOLEAN := false;
BEGIN
    -- A. Validate Table Existence
    SELECT id, table_name, capacity INTO v_table_record
    FROM public.tables_layout
    WHERE id = p_table_id
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Table with ID % not found.', p_table_id;
    END IF;

    -- B. Validate Items Payload
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Cart is empty. At least one order item is required.';
    END IF;
    v_items_count := jsonb_array_length(p_items);

    -- C. Locate or Lock Active Table Session (Fresh within 16h)
    SELECT * INTO v_existing_booking
    FROM public.bookings
    WHERE table_id = p_table_id
      AND status IN ('pending', 'confirmed', 'seated', 'ready')
      AND (booking_time IS NULL OR booking_time >= NOW() - INTERVAL '16 hours')
    ORDER BY booking_time DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        v_booking_id := v_existing_booking.id;
        v_tracking_token := COALESCE(v_existing_booking.tracking_token, p_tracking_token, gen_random_uuid()::TEXT);
        
        -- Build updated remark
        v_remark := COALESCE(v_existing_booking.staff_remark, 'QR Walk-in Guest');
        IF LOWER(v_remark) NOT LIKE '%qr%' THEN
            v_remark := '[QR] ' || v_remark;
        END IF;
        IF p_customer_note IS NOT NULL AND TRIM(p_customer_note) <> '' AND v_remark NOT LIKE '%' || TRIM(p_customer_note) || '%' THEN
            v_remark := v_remark || ' [NOTE: ' || TRIM(p_customer_note) || ']';
        END IF;

        -- Update session metadata
        UPDATE public.bookings
        SET staff_remark = v_remark,
            tracking_token = v_tracking_token,
            status = 'seated',
            source = 'qr',
            user_id = COALESCE(v_existing_booking.user_id, p_user_id),
            updated_at = NOW()
        WHERE id = v_booking_id;
    ELSE
        -- Create new active session
        v_is_new := true;
        v_tracking_token := COALESCE(p_tracking_token, gen_random_uuid()::TEXT);
        v_remark := '[QR] QR Walk-in Guest';
        IF p_customer_note IS NOT NULL AND TRIM(p_customer_note) <> '' THEN
            v_remark := v_remark || ' [NOTE: ' || TRIM(p_customer_note) || ']';
        END IF;

        INSERT INTO public.bookings (
            table_id,
            status,
            booking_type,
            booking_time,
            pax,
            staff_remark,
            tracking_token,
            total_amount,
            user_id,
            source,
            created_at,
            updated_at
        ) VALUES (
            p_table_id,
            'seated',
            'walk_in',
            NOW(),
            COALESCE(p_pax, v_table_record.capacity, 2),
            v_remark,
            v_tracking_token,
            0.00,
            p_user_id,
            'qr',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_booking_id;
    END IF;

    -- D. Batch Insert Order Items
    INSERT INTO public.order_items (
        booking_id,
        menu_item_id,
        quantity,
        price_at_time,
        destination,
        custom_name,
        is_custom,
        selected_options,
        status,
        created_at
    )
    SELECT 
        v_booking_id,
        NULLIF(item->>'menu_item_id', '')::BIGINT,
        COALESCE((item->>'quantity')::INT, 1),
        COALESCE((item->>'price_at_time')::NUMERIC(10, 2), 0.00),
        COALESCE(item->>'destination', 'kitchen'),
        NULLIF(item->>'custom_name', ''),
        COALESCE((item->>'is_custom')::BOOLEAN, false),
        COALESCE(item->'selected_options', '{}'::jsonb),
        'pending',
        NOW()
    FROM jsonb_array_elements(p_items) AS item;

    -- E. Atomically Recalculate Total Amount from All Items
    SELECT COALESCE(SUM(COALESCE(price_at_time, 0.00) * COALESCE(quantity, 1)), 0.00)
    INTO v_total_amount
    FROM public.order_items
    WHERE booking_id = v_booking_id;

    UPDATE public.bookings
    SET total_amount = v_total_amount,
        updated_at = NOW()
    WHERE id = v_booking_id;

    -- F. Return Structured Success Payload
    RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'table_id', p_table_id,
        'table_name', v_table_record.table_name,
        'tracking_token', v_tracking_token,
        'total_amount', v_total_amount,
        'items_count', v_items_count,
        'is_new_booking', v_is_new,
        'status', 'seated'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant Permissions
GRANT EXECUTE ON FUNCTION public.submit_customer_qr_order(INT, JSONB, UUID, INT, TEXT, TEXT) TO anon, authenticated, service_role;
