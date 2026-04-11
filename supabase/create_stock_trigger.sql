-- Trigger function to update current_quantity in stock_items
CREATE OR REPLACE FUNCTION public.handle_stock_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the stock_items table based on the transaction
    -- We assume quantity_change is already signed correctly (positive for 'in', negative for 'out')
    -- For 'set' or 'audit', the RPC or API should calculate the diff and send it as quantity_change
    
    UPDATE public.stock_items
    SET current_quantity = current_quantity + NEW.quantity_change,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.stock_item_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_stock_transaction_sync ON public.stock_transactions;
CREATE TRIGGER trg_stock_transaction_sync
AFTER INSERT ON public.stock_transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_transaction();

-- Note: If you use the existing set_stock_quantity RPC, 
-- you should update it to NOT update stock_items directly 
-- to avoid double-calculation, or adjust it accordingly.
