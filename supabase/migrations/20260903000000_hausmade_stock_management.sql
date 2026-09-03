-- ==============================================================================
-- Migration: HAUSMADE Immediate Stock Deduction & Restoration RPCs
-- Date: 2026-09-03
-- ==============================================================================

-- 1. RPC: Deduct stock for all items in a booking immediately
CREATE OR REPLACE FUNCTION public.deduct_order_stock(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item RECORD;
    deducted_count INT := 0;
BEGIN
    FOR item IN 
        SELECT menu_item_id, quantity 
        FROM public.order_items 
        WHERE booking_id = p_booking_id AND menu_item_id IS NOT NULL
    LOOP
        UPDATE public.menu_items
        SET 
            remaining_stock = GREATEST(0, COALESCE(remaining_stock, stock_quantity, 0) - item.quantity),
            stock_quantity = GREATEST(0, COALESCE(stock_quantity, remaining_stock, 0) - item.quantity),
            updated_at = NOW()
        WHERE id = item.menu_item_id;

        deducted_count := deducted_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'booking_id', p_booking_id,
        'items_deducted', deducted_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 2. RPC: Restore stock for all items in a booking (e.g. on cancellation / void)
CREATE OR REPLACE FUNCTION public.restore_order_stock(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item RECORD;
    restored_count INT := 0;
BEGIN
    FOR item IN 
        SELECT menu_item_id, quantity 
        FROM public.order_items 
        WHERE booking_id = p_booking_id AND menu_item_id IS NOT NULL
    LOOP
        UPDATE public.menu_items
        SET 
            remaining_stock = COALESCE(remaining_stock, 0) + item.quantity,
            stock_quantity = COALESCE(stock_quantity, 0) + item.quantity,
            updated_at = NOW()
        WHERE id = item.menu_item_id;

        restored_count := restored_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'booking_id', p_booking_id,
        'items_restored', restored_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 3. Automatic Trigger on Bookings table to restore stock when cancelled/voided
CREATE OR REPLACE FUNCTION public.trg_fn_auto_restore_stock_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (OLD.status NOT IN ('cancelled', 'void') AND NEW.status IN ('cancelled', 'void')) THEN
        PERFORM public.restore_order_stock(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_restore_stock ON public.bookings;
CREATE TRIGGER trg_auto_restore_stock
    AFTER UPDATE OF status ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_auto_restore_stock_on_cancel();

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
