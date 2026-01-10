-- Create RPC for setting absolute stock quantity (Audit/Count)
CREATE OR REPLACE FUNCTION public.set_stock_quantity(
    p_item_id UUID,
    p_new_quantity FLOAT,
    p_reason TEXT DEFAULT 'Audit'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_quantity FLOAT;
    v_diff FLOAT;
BEGIN
    -- Get current quantity
    SELECT current_quantity INTO v_old_quantity
    FROM public.stock_items
    WHERE id = p_item_id;

    -- Calculate difference for logging
    v_diff := p_new_quantity - COALESCE(v_old_quantity, 0);

    -- Update stock
    UPDATE public.stock_items
    SET current_quantity = p_new_quantity,
        updated_at = NOW()
    WHERE id = p_item_id;

    -- Log transaction
    INSERT INTO public.stock_transactions (stock_item_id, transaction_type, quantity_change, performed_by, note)
    VALUES (p_item_id, 'set', v_diff, 'Staff', p_reason);
END;
$$;
