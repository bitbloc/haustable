-- 1. Reset Data (Wipe)
TRUNCATE TABLE public.bookings CASCADE;
-- CASCADE will automatically clear public.order_items that reference bookings

-- 2. Add Status to Order Items (KDS Ready)
-- Check if column exists first to avoid error, or just run ALTER
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- 3. Optional: Add Constraint for Status Enum
-- ALTER TABLE public.order_items 
-- ADD CONSTRAINT order_items_status_check 
-- CHECK (status IN ('pending', 'cooking', 'served', 'cancelled'));

-- 4. Verify
SELECT * FROM public.order_items LIMIT 1;
