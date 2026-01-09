-- Create RPC for atomic stock updates
CREATE OR REPLACE FUNCTION public.update_stock_quantity(
    p_item_id UUID,
    p_quantity_change FLOAT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.stock_items
    SET current_quantity = COALESCE(current_quantity, 0) + p_quantity_change,
        updated_at = NOW()
    WHERE id = p_item_id;
    
    -- If row not found, maybe raise exception? 
    -- But for now we assume it exists.
END;
$$;
