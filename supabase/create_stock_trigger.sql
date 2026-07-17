-- Trigger function to update current_quantity in stock_items
-- FIX: Skips 'set'/'audit' types which are handled atomically by set_stock_quantity RPC
CREATE OR REPLACE FUNCTION public.handle_stock_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip 'set' and 'audit' types: handled atomically by set_stock_quantity RPC
    -- to prevent double-counting (RPC already directly updates current_quantity)
    IF NEW.transaction_type IN ('set', 'audit') THEN
        RETURN NEW;
    END IF;

    -- For relative changes ('in', 'out'), add the signed quantity_change
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

