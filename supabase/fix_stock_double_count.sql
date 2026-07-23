-- ============================================================
-- FIX: Stock Double-Count Bug
-- ปัญหา: กด +/- ใน stock แล้วค่าเบิ้ล
-- สาเหตุ: มี duplicate trigger (trg_stock_transaction_sync_v2)
--         ทำให้ INSERT ทุกครั้ง trigger fire 2 รอบ → ค่าเบิ้ล
-- ============================================================

-- Step 1: Re-deploy the trigger function with skip logic
CREATE OR REPLACE FUNCTION public.handle_stock_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_type IN ('set', 'audit') THEN
        RETURN NEW;
    END IF;

    UPDATE public.stock_items
    SET current_quantity = current_quantity + NEW.quantity_change,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.stock_item_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Drop ALL triggers แล้วสร้างใหม่ตัวเดียว
DROP TRIGGER IF EXISTS trg_stock_transaction_sync ON public.stock_transactions;
DROP TRIGGER IF EXISTS trg_stock_transaction_sync_v2 ON public.stock_transactions;
DROP TRIGGER IF EXISTS stock_transaction_trigger ON public.stock_transactions;
DROP TRIGGER IF EXISTS handle_stock_transaction_trigger ON public.stock_transactions;

CREATE TRIGGER trg_stock_transaction_sync
AFTER INSERT ON public.stock_transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_transaction();

-- Step 3: Verify (ต้องเหลือ 1 ตัวเท่านั้น)
SELECT tgname, tgtype, tgenabled
FROM pg_trigger 
WHERE tgrelid = 'public.stock_transactions'::regclass
AND NOT tgisinternal;
