-- Optimizations Part 2: Addressing missing indexes found in code review

-- 1. Bookings: User History
-- Used in: useUserHistory.js (select * from bookings where user_id = ... order by created_at desc)
CREATE INDEX IF NOT EXISTS idx_bookings_user_history 
ON public.bookings (user_id, created_at DESC);

-- 2. Stock Items: Category Filtering
-- Used in: StockPage.jsx (select * from stock_items where category = ...)
CREATE INDEX IF NOT EXISTS idx_stock_items_category 
ON public.stock_items (category);

-- 3. Bookings: General Date Range (without status)
-- Sometimes we might query log/history purely by date
CREATE INDEX IF NOT EXISTS idx_bookings_booking_time 
ON public.bookings (booking_time);

-- 4. Audit Log / Transactions: Staff Performance
-- If you query "Who did what?" filtering by 'performed_by'
CREATE INDEX IF NOT EXISTS idx_stock_transactions_performed_by
ON public.stock_transactions (performed_by);

-- 5. Profiles: Search by Phone (for Member lookup)
-- Used in: AdminMembers.jsx or similar lookup
CREATE INDEX IF NOT EXISTS idx_profiles_phone 
ON public.profiles (phone_number);

-- Note: Run 'VACUUM ANALYZE;' occasionally if you delete/update lots of rows (like resetting stock).
