-- Create RPC for setting absolute stock quantity (Audit/Count)
-- FIX: Uses FOR UPDATE row lock + direct SET to prevent race conditions.
-- The trigger (handle_stock_transaction) MUST skip 'set'/'audit' types
-- to avoid double-counting.
CREATE OR REPLACE FUNCTION public.set_stock_quantity(
    p_item_id UUID,
    p_new_quantity FLOAT,
    p_reason TEXT DEFAULT 'Audit',
    p_performed_by TEXT DEFAULT 'Staff'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_quantity FLOAT;
    v_diff FLOAT;
BEGIN
    -- Lock the row to prevent concurrent reads (race condition fix)
    SELECT current_quantity INTO v_old_quantity
    FROM public.stock_items
    WHERE id = p_item_id
    FOR UPDATE;

    -- Calculate difference for audit logging
    v_diff := p_new_quantity - COALESCE(v_old_quantity, 0);

    -- Directly SET the quantity (atomic — not via trigger)
    UPDATE public.stock_items
    SET current_quantity = p_new_quantity,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_item_id;

    -- Log the transaction with the calculated diff
    -- Note: trigger skips 'set' type, so this won't double-count
    INSERT INTO public.stock_transactions (stock_item_id, transaction_type, quantity_change, performed_by, note)
    VALUES (p_item_id, 'set', v_diff, p_performed_by, p_reason);
END;
$$;
